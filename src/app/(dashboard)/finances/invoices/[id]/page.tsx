import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getInvoiceById } from '@/lib/queries/invoice-queries';
import {
  markInvoiceSentAction,
  markInvoicePaidAction,
  deleteInvoiceAction,
  duplicateInvoiceAction,
  generateStripeLink,
  syncStripePaymentAction,
  toggleRecurringAction,
  updateRecurrenceDayAction,
} from '@/lib/actions/invoice-actions';
import { isStripeConfigured } from '@/lib/stripe';
import { getDocumentsForEntity } from '@/lib/queries/document-queries';
import { DocumentUpload } from '@/components/document-upload';
import { StatusBadge } from '@/components/status-badge';
import { SendInvoiceEmail } from '@/components/send-invoice-email';

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const invoice = getInvoiceById(db, Number(id));
  if (!invoice) notFound();

  const stripeEnabled = isStripeConfigured();
  const displayStatus = invoice.is_overdue ? 'overdue' : invoice.status;

  return (
    <div className="p-4 sm:p-6">
      <Link href="/finances" className="text-sm text-gray-400 hover:text-white mb-4 inline-block">
        &larr; Back to Finances
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">{invoice.invoice_number}</h2>
          <Link href={`/clients/${invoice.client_id}`} className="text-gray-400 hover:text-white text-sm">
            {invoice.client_name}
          </Link>
        </div>
        <StatusBadge status={displayStatus} />
      </div>

      <div className="flex gap-2 mb-6">
        <a
          href={`/api/invoices/${invoice.id}/pdf`}
          target="_blank"
          className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
        >
          View / Print
        </a>
        <Link
          href={`/finances/invoices/${invoice.id}/edit`}
          className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
        >
          Edit
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Total</p>
          <p className="text-lg font-bold text-white">${invoice.total_amount.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Due Date</p>
          <p className={`text-sm ${invoice.is_overdue ? 'text-red-400' : 'text-white'}`}>{invoice.due_date}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Sent</p>
          <p className="text-sm text-white">{invoice.sent_at || '—'}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Paid</p>
          <p className="text-sm text-white">{invoice.paid_at || '—'}</p>
        </div>
      </div>

      <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase mb-1">Recurring</p>
            <p className="text-sm text-white">
              {invoice.is_recurring === 1
                ? `Active — Day ${invoice.recurrence_day} of each month`
                : 'Not recurring'}
            </p>
          </div>
          <form action={toggleRecurringAction}>
            <input type="hidden" name="id" value={invoice.id} />
            <button type="submit"
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                invoice.is_recurring === 1
                  ? 'text-red-400 border border-red-900 hover:bg-red-900/20'
                  : 'text-green-400 border border-green-900 hover:bg-green-900/20'
              }`}>
              {invoice.is_recurring === 1 ? 'Deactivate' : 'Activate'}
            </button>
          </form>
        </div>
        {invoice.is_recurring === 1 && (
          <form action={updateRecurrenceDayAction} className="mt-3 flex items-center gap-2">
            <input type="hidden" name="id" value={invoice.id} />
            <label className="text-xs text-gray-500">Change day:</label>
            <input type="number" name="day" min={1} max={28} defaultValue={invoice.recurrence_day ?? 1}
              className="w-16 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm" />
            <button type="submit"
              className="px-3 py-1 text-xs text-blue-400 border border-blue-800 rounded hover:bg-blue-900/20 transition-colors">
              Update
            </button>
          </form>
        )}
      </div>

      {invoice.notes && (
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg mb-6">
          <p className="text-xs text-gray-500 uppercase mb-1">Notes</p>
          <p className="text-sm text-white">{invoice.notes}</p>
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">Line Items</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left text-gray-500">
              <th className="pb-2 font-medium">Description</th>
              <th className="pb-2 font-medium text-right">Qty</th>
              <th className="pb-2 font-medium text-right">Unit Price</th>
              <th className="pb-2 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id} className="border-b border-gray-800/50">
                <td className="py-2 text-white">{item.description}</td>
                <td className="py-2 text-right text-gray-400">{item.quantity}</td>
                <td className="py-2 text-right text-gray-400">${item.unit_price.toLocaleString()}</td>
                <td className="py-2 text-right text-white">${item.amount.toLocaleString()}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={3} className="py-3 text-right font-medium text-gray-400">Total</td>
              <td className="py-3 text-right font-bold text-white">${invoice.total_amount.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {invoice.stripe_payment_link && (
        <div className="p-4 bg-blue-900/20 border border-blue-800 rounded-lg mb-6">
          <p className="text-sm text-blue-400">
            Payment link: <a href={invoice.stripe_payment_link} target="_blank" rel="noreferrer" className="underline">{invoice.stripe_payment_link}</a>
          </p>
        </div>
      )}

      {/* Email Invoice */}
      {invoice.status !== 'paid' && (
        <div className="mb-6">
          <SendInvoiceEmail
            invoiceId={invoice.id}
            clientEmail={invoice.client_email || null}
            invoiceNumber={invoice.invoice_number}
            amount={invoice.total_amount}
            dueDate={invoice.due_date}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-8">
        {invoice.status === 'draft' && (
          <>
            <Link href={`/finances/invoices/${invoice.id}/edit`}
              className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white hover:border-gray-600 transition-colors">
              Edit
            </Link>
            <form action={markInvoiceSentAction}>
              <input type="hidden" name="id" value={invoice.id} />
              <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
                Mark Sent
              </button>
            </form>
          </>
        )}
        {(invoice.status === 'sent' || invoice.is_overdue) && (
          <>
            <form action={markInvoicePaidAction}>
              <input type="hidden" name="id" value={invoice.id} />
              <button type="submit" className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">
                Mark Paid
              </button>
            </form>
            {stripeEnabled && !invoice.stripe_payment_link && (
              <form action={generateStripeLink}>
                <input type="hidden" name="id" value={invoice.id} />
                <button type="submit" className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors">
                  Generate Stripe Link
                </button>
              </form>
            )}
            {stripeEnabled && invoice.stripe_payment_link && (
              <form action={syncStripePaymentAction}>
                <input type="hidden" name="id" value={invoice.id} />
                <button type="submit" className="px-4 py-2 text-sm text-purple-400 border border-purple-800 rounded-lg hover:bg-purple-900/20 transition-colors">
                  Check Stripe Payment
                </button>
              </form>
            )}
          </>
        )}
        <form action={duplicateInvoiceAction}>
          <input type="hidden" name="id" value={invoice.id} />
          <button type="submit" className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white hover:border-gray-600 transition-colors">
            Duplicate
          </button>
        </form>
        {invoice.status !== 'draft' && (
          <a href={`/api/invoices/${invoice.id}/pdf`}
            className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white hover:border-gray-600 transition-colors">
            Download PDF
          </a>
        )}
      </div>

      <DocumentUpload entityType="invoice" entityId={invoice.id} documents={getDocumentsForEntity(db, 'invoice', invoice.id)} />

      {invoice.status === 'draft' && (
        <div className="pt-6 border-t border-gray-800">
          <form action={deleteInvoiceAction}>
            <input type="hidden" name="id" value={invoice.id} />
            <button type="submit"
              className="px-4 py-2 text-sm text-red-400 border border-red-900 rounded-lg hover:bg-red-900/20 transition-colors">
              Delete Invoice
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
