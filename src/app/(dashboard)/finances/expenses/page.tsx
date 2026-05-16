import { getDb } from '@/lib/db';
import { FinanceTabs } from '@/components/finance-tabs';
import { createExpenseAction } from '@/lib/actions/expense-actions';

export const dynamic = 'force-dynamic';

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; start?: string; end?: string }>;
}) {
  const sp = await searchParams;
  const db = getDb();

  // Build query
  const conditions: string[] = [];
  const params: any[] = [];
  if (sp.category) { conditions.push('e.category = ?'); params.push(sp.category); }
  if (sp.start) { conditions.push('e.expense_date >= ?'); params.push(sp.start); }
  if (sp.end) { conditions.push('e.expense_date <= ?'); params.push(sp.end); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const expenses = db.prepare(`
    SELECT e.*, COALESCE(c.name, '—') as client_name
    FROM expenses e LEFT JOIN clients c ON e.client_id = c.id
    ${where} ORDER BY e.expense_date DESC LIMIT 100
  `).all(...params) as any[];

  // Category totals
  const categoryTotals = db.prepare(`
    SELECT category, SUM(amount) as total, COUNT(*) as count
    FROM expenses GROUP BY category ORDER BY total DESC
  `).all() as any[];

  // Monthly total
  const monthStart = new Date().toISOString().slice(0, 7) + '-01';
  const monthTotal = (db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE expense_date >= ?'
  ).get(monthStart) as any).total;

  const clients = db.prepare("SELECT id, name FROM clients WHERE deleted_at IS NULL ORDER BY name").all() as { id: number; name: string }[];

  const categories = ['servers', 'software', 'contractor', 'marketing', 'other'];

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-bold mb-4">Finances</h1>
      <FinanceTabs active="expenses" />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase">This Month</p>
          <p className="text-xl font-bold text-white">${monthTotal.toLocaleString()}</p>
        </div>
        {categoryTotals.slice(0, 3).map((ct: any) => (
          <div key={ct.category} className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
            <p className="text-xs text-gray-500 uppercase">{ct.category}</p>
            <p className="text-xl font-bold text-white">${ct.total.toLocaleString()}</p>
            <p className="text-xs text-gray-500">{ct.count} entries</p>
          </div>
        ))}
      </div>

      {/* Add Expense Form */}
      <form action={createExpenseAction} className="p-4 bg-gray-900 border border-gray-800 rounded-lg mb-6">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Add Expense</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <input type="text" name="description" required placeholder="Description" className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
          <input type="number" name="amount" required step="0.01" placeholder="Amount" className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
          <select name="category" required className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="date" name="expense_date" required defaultValue={new Date().toISOString().split('T')[0]} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
          <select name="client_id" className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
            <option value="">No client</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button type="submit" className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors">
          Add
        </button>
      </form>

      {/* Filters */}
      <form className="flex flex-wrap gap-3 mb-6">
        <select name="category" defaultValue={sp.category || ''} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="date" name="start" defaultValue={sp.start || ''} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
        <input type="date" name="end" defaultValue={sp.end || ''} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
        <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors">Filter</button>
      </form>

      {/* Expenses List */}
      {expenses.length === 0 ? (
        <p className="text-gray-500 text-sm">No expenses found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-left">
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Description</th>
                <th className="pb-2 pr-4">Category</th>
                <th className="pb-2 pr-4">Client</th>
                <th className="pb-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e: any) => (
                <tr key={e.id} className="border-b border-gray-800/50">
                  <td className="py-2 pr-4 text-white">{e.expense_date}</td>
                  <td className="py-2 pr-4 text-gray-300">{e.description}</td>
                  <td className="py-2 pr-4">
                    <span className="text-xs px-2 py-0.5 bg-gray-800 text-gray-400 rounded">{e.category}</span>
                  </td>
                  <td className="py-2 pr-4 text-gray-400">{e.client_name}</td>
                  <td className="py-2 text-right text-white">${e.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
