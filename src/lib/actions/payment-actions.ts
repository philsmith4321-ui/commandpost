'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { addPayment, deletePayment, getTotalPaid } from '@/lib/queries/payment-queries';
import { getInvoiceById, markInvoicePaid } from '@/lib/queries/invoice-queries';
import { logAudit } from '@/lib/audit';

export async function addPaymentAction(formData: FormData) {
  const db = getDb();
  const invoiceId = Number(formData.get('invoice_id'));
  const amount = Number(formData.get('amount'));
  const method = (formData.get('payment_method') as string) || 'other';
  const notes = (formData.get('notes') as string) || null;

  addPayment(db, { invoice_id: invoiceId, amount, payment_method: method, notes });
  logAudit(db, 'invoice', invoiceId, `payment_received: $${amount}`);

  // Check if fully paid
  const invoice = getInvoiceById(db, invoiceId);
  const totalPaid = getTotalPaid(db, invoiceId);
  if (invoice && totalPaid >= invoice.total_amount) {
    markInvoicePaid(db, invoiceId);
    logAudit(db, 'invoice', invoiceId, 'fully_paid');
  }

  revalidatePath('/finances');
  revalidatePath(`/finances/invoices/${invoiceId}`);
}

export async function deletePaymentAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  const invoiceId = Number(formData.get('invoice_id'));
  deletePayment(db, id);
  revalidatePath(`/finances/invoices/${invoiceId}`);
}
