import { getDb } from '@/lib/db';
import { getOverdueInvoices } from '@/lib/queries/invoice-queries';
import { markReminderSentAction } from '@/lib/actions/invoice-actions';
import { FinanceTabs } from '@/components/finance-tabs';
import Link from 'next/link';

export default async function OverduePage() {
  const db = getDb();
  const overdue = getOverdueInvoices(db);
  const totalOverdue = overdue.reduce((sum, inv) => sum + inv.total_amount, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Finances</h1>
      <FinanceTabs active="overdue" />

      <div className="mb-6 flex items-center gap-6">
        <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3">
          <p className="text-sm text-red-400">Total Overdue</p>
          <p className="text-2xl font-bold text-red-300">${totalOverdue.toLocaleString()}</p>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-3">
          <p className="text-sm text-gray-400">Overdue Invoices</p>
          <p className="text-2xl font-bold">{overdue.length}</p>
        </div>
      </div>

      {overdue.length === 0 ? (
        <p className="text-gray-400">No overdue invoices. All caught up!</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-400">
                <th className="pb-2 pr-4">Invoice</th>
                <th className="pb-2 pr-4">Client</th>
                <th className="pb-2 pr-4">Amount</th>
                <th className="pb-2 pr-4">Due Date</th>
                <th className="pb-2 pr-4">Days Overdue</th>
                <th className="pb-2 pr-4">Last Reminder</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {overdue.map((inv) => (
                <tr key={inv.id} className="border-b border-gray-800/50">
                  <td className="py-3 pr-4">
                    <Link href={`/finances/invoices/${inv.id}`} className="text-blue-400 hover:underline">
                      {inv.invoice_number}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">
                    <Link href={`/clients/${inv.client_id}`} className="hover:text-white">
                      {inv.client_name}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 font-medium">${inv.total_amount.toLocaleString()}</td>
                  <td className="py-3 pr-4">{inv.due_date}</td>
                  <td className="py-3 pr-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      inv.days_overdue > 30 ? 'bg-red-900/50 text-red-300' :
                      inv.days_overdue > 14 ? 'bg-orange-900/50 text-orange-300' :
                      'bg-yellow-900/50 text-yellow-300'
                    }`}>
                      {inv.days_overdue}d
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-gray-400 text-xs">
                    {inv.last_reminder_sent
                      ? new Date(inv.last_reminder_sent + 'Z').toLocaleDateString()
                      : 'Never'}
                  </td>
                  <td className="py-3">
                    <form action={markReminderSentAction} className="inline">
                      <input type="hidden" name="id" value={inv.id} />
                      <button
                        type="submit"
                        className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded"
                      >
                        Mark Reminded
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
