import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getInvoiceById } from '@/lib/queries/invoice-queries';
import { listClients } from '@/lib/queries/client-queries';
import { updateInvoiceAction } from '@/lib/actions/invoice-actions';
import { InvoiceLineItems } from '@/components/invoice-line-items';

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const invoice = getInvoiceById(db, Number(id));
  if (!invoice) notFound();
  if (invoice.status !== 'draft') redirect(`/finances/invoices/${id}`);

  const clients = listClients(db);

  return (
    <div className="p-4 sm:p-6">
      <Link href={`/finances/invoices/${id}`} className="text-sm text-gray-400 hover:text-white mb-4 inline-block">
        &larr; Back to {invoice.invoice_number}
      </Link>
      <h2 className="text-2xl font-bold mb-6">Edit Invoice</h2>

      <form action={updateInvoiceAction} className="space-y-4 max-w-2xl">
        <input type="hidden" name="id" value={invoice.id} />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Client</label>
            <p className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">{invoice.client_name}</p>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Due Date *</label>
            <input type="date" name="due_date" required defaultValue={invoice.due_date}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
          </div>
        </div>

        <InvoiceLineItems initialItems={invoice.items.map(i => ({
          description: i.description,
          quantity: i.quantity,
          unit_price: i.unit_price,
        }))} />

        <div>
          <label className="block text-sm text-gray-400 mb-1">Notes</label>
          <textarea name="notes" rows={2} defaultValue={invoice.notes ?? ''}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input type="checkbox" name="is_recurring" defaultChecked={invoice.is_recurring === 1} className="rounded bg-gray-800 border-gray-700" />
            Recurring invoice
          </label>
          <input type="number" name="recurrence_day" min="1" max="28" placeholder="Day (1-28)"
            defaultValue={invoice.recurrence_day ?? ''}
            className="w-32 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
        </div>

        <button type="submit"
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
          Save Changes
        </button>
      </form>
    </div>
  );
}
