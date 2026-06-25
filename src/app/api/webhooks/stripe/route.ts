import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { markInvoicePaid, setStripePaymentId } from '@/lib/queries/invoice-queries';
import { logAudit } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';

interface StripeWebhookEvent {
  type?: string;
  data?: {
    object?: {
      id?: string;
      payment_intent?: string;
      client_reference_id?: string;
      metadata?: { invoice_number?: string } | null;
    };
  };
}

interface InvoiceRow {
  id: number;
  invoice_number: string;
  total_amount: number;
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const body = await request.text();
  let event: StripeWebhookEvent;

  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Handle checkout.session.completed events
  if (event.type === 'checkout.session.completed') {
    const session = event.data?.object;
    const paymentId = session?.payment_intent || session?.id;
    const invoiceNumber = session?.metadata?.invoice_number || session?.client_reference_id;

    if (invoiceNumber && paymentId) {
      const db = getDb();
      const invoice = db.prepare(
        "SELECT id, invoice_number, total_amount FROM invoices WHERE invoice_number = ? AND status != 'paid'"
      ).get(invoiceNumber) as InvoiceRow | undefined;

      if (invoice) {
        setStripePaymentId(db, invoice.id, paymentId);
        markInvoicePaid(db, invoice.id);
        logAudit(db, 'invoice', invoice.id, 'paid_via_stripe', paymentId);

        await createNotification(db, {
          type: 'invoice_paid',
          title: `${invoice.invoice_number} paid via Stripe`,
          message: `$${invoice.total_amount}`,
          link: `/finances/invoices/${invoice.id}`,
        });
      }
    }
  }

  // Handle payment_intent.succeeded
  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data?.object;
    const paymentId = intent?.id;
    const invoiceNumber = intent?.metadata?.invoice_number;

    if (invoiceNumber && paymentId) {
      const db = getDb();
      const invoice = db.prepare(
        "SELECT id, invoice_number, total_amount FROM invoices WHERE invoice_number = ? AND status != 'paid'"
      ).get(invoiceNumber) as InvoiceRow | undefined;

      if (invoice) {
        setStripePaymentId(db, invoice.id, paymentId);
        markInvoicePaid(db, invoice.id);
        logAudit(db, 'invoice', invoice.id, 'paid_via_stripe', paymentId);

        await createNotification(db, {
          type: 'invoice_paid',
          title: `${invoice.invoice_number} paid via Stripe`,
          message: `$${invoice.total_amount}`,
          link: `/finances/invoices/${invoice.id}`,
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
