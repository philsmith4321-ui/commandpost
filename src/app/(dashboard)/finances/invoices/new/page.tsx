import Link from 'next/link';
import { getDb } from '@/lib/db';
import { listClients } from '@/lib/queries/client-queries';
import { createInvoiceAction } from '@/lib/actions/invoice-actions';
import { InvoiceLineItems } from '@/components/invoice-line-items';

export default function NewInvoicePage() {
  const db = getDb();
  const clients = listClients(db);

  // Preview next invoice number
  const last = db.prepare("SELECT invoice_number FROM invoices ORDER BY id DESC LIMIT 1").get() as { invoice_number: string } | undefined;
  const nextNumber = last ? `INV-${String(parseInt(last.invoice_number.replace('INV-', ''), 10) + 1).padStart(4, '0')}` : 'INV-0001';

  // Default due date: 14 days from now
  const defaultDue = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

  return (
    <div className="p-4 sm:p-6">
      <Link href="/finances" className="text-sm text-gray-400 hover:text-white mb-4 inline-block">
        &larr; Back to Finances
      </Link>
      <div className="flex items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold">New Invoice</h2>
        <span className="px-3 py-1 bg-gray-800 text-gray-400 text-sm rounded-lg font-mono">{nextNumber}</span>
      </div>

      <form action={createInvoiceAction} className="space-y-4 max-w-2xl">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Client *</label>
            <select name="client_id" required
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500">
              <option value="">Select client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Due Date *</label>
            <input type="date" name="due_date" required defaultValue={defaultDue}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
          </div>
        </div>

        <InvoiceLineItems />

        <div>
          <label className="block text-sm text-gray-400 mb-1">Notes</label>
          <textarea name="notes" rows={2}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input type="checkbox" name="is_recurring" className="rounded bg-gray-800 border-gray-700" />
            Recurring invoice
          </label>
          <div>
            <input type="number" name="recurrence_day" min="1" max="28" placeholder="Day (1-28)"
              className="w-32 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
          </div>
        </div>

        <button type="submit"
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
          Create Invoice
        </button>
      </form>
    </div>
  );
}
