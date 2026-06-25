import { getDb } from '@/lib/db';
import { FinanceTabs } from '@/components/finance-tabs';
import { createExpenseAction, deleteExpenseAction, saveBudgetAction } from '@/lib/actions/expense-actions';

export const dynamic = 'force-dynamic';

interface ExpenseRow {
  id: number;
  description: string;
  amount: number;
  category: string;
  expense_date: string;
  client_name: string;
}

interface CategoryTotal {
  category: string;
  total: number;
  count: number;
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; start?: string; end?: string }>;
}) {
  const sp = await searchParams;
  const db = getDb();

  // Build query
  const conditions: string[] = [];
  const params: string[] = [];
  if (sp.category) { conditions.push('e.category = ?'); params.push(sp.category); }
  if (sp.start) { conditions.push('e.expense_date >= ?'); params.push(sp.start); }
  if (sp.end) { conditions.push('e.expense_date <= ?'); params.push(sp.end); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const expenses = db.prepare(`
    SELECT e.*, COALESCE(c.name, '—') as client_name
    FROM expenses e LEFT JOIN clients c ON e.client_id = c.id
    ${where} ORDER BY e.expense_date DESC LIMIT 100
  `).all(...params) as ExpenseRow[];

  // Category totals
  const categoryTotals = db.prepare(`
    SELECT category, SUM(amount) as total, COUNT(*) as count
    FROM expenses GROUP BY category ORDER BY total DESC
  `).all() as CategoryTotal[];

  // Monthly total
  const monthStart = new Date().toISOString().slice(0, 7) + '-01';
  const monthTotal = (db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE expense_date >= ?'
  ).get(monthStart) as { total: number }).total;

  const clients = db.prepare("SELECT id, name FROM clients WHERE deleted_at IS NULL ORDER BY name").all() as { id: number; name: string }[];

  const categories = ['servers', 'software', 'contractor', 'marketing', 'other'];

  // Monthly trends (last 6 months)
  const monthlyTrends = db.prepare(`
    SELECT strftime('%Y-%m', expense_date) as month, SUM(amount) as total
    FROM expenses WHERE expense_date >= date('now', '-6 months')
    GROUP BY month ORDER BY month
  `).all() as { month: string; total: number }[];

  // Budgets
  const budgets = db.prepare('SELECT * FROM expense_budgets').all() as { category: string; monthly_limit: number }[];
  const budgetMap: Record<string, number> = {};
  for (const b of budgets) budgetMap[b.category] = b.monthly_limit;

  // This month spending by category
  const monthSpending = db.prepare(`
    SELECT category, SUM(amount) as total FROM expenses WHERE expense_date >= ? GROUP BY category
  `).all(monthStart) as { category: string; total: number }[];
  const monthSpendMap: Record<string, number> = {};
  for (const s of monthSpending) monthSpendMap[s.category] = s.total;

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
        {categoryTotals.slice(0, 3).map((ct) => (
          <div key={ct.category} className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
            <p className="text-xs text-gray-500 uppercase">{ct.category}</p>
            <p className="text-xl font-bold text-white">${ct.total.toLocaleString()}</p>
            <p className="text-xs text-gray-500">{ct.count} entries</p>
          </div>
        ))}
      </div>

      {/* Category Breakdown Chart */}
      {categoryTotals.length > 0 && (() => {
        const grandTotal = categoryTotals.reduce((s, c) => s + c.total, 0);
        const colors: Record<string, string> = { servers: 'bg-blue-500', software: 'bg-purple-500', contractor: 'bg-yellow-500', marketing: 'bg-green-500', other: 'bg-gray-500' };
        return (
          <div className="mb-6 p-4 bg-gray-900 border border-gray-800 rounded-lg">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Spending by Category</h3>
            <div className="h-4 rounded-full overflow-hidden flex mb-3">
              {categoryTotals.map((ct) => (
                <div key={ct.category} className={`${colors[ct.category] || 'bg-gray-500'}`} style={{ width: `${(ct.total / grandTotal) * 100}%` }} title={`${ct.category}: $${ct.total.toLocaleString()}`} />
              ))}
            </div>
            <div className="flex flex-wrap gap-4">
              {categoryTotals.map((ct) => (
                <div key={ct.category} className="flex items-center gap-2 text-xs">
                  <div className={`w-3 h-3 rounded ${colors[ct.category] || 'bg-gray-500'}`} />
                  <span className="text-gray-400">{ct.category}</span>
                  <span className="text-white">${ct.total.toLocaleString()}</span>
                  <span className="text-gray-600">({Math.round((ct.total / grandTotal) * 100)}%)</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Monthly Trend */}
      {monthlyTrends.length > 0 && (() => {
        const maxTotal = Math.max(...monthlyTrends.map(m => m.total), 1);
        return (
          <div className="mb-6 p-4 bg-gray-900 border border-gray-800 rounded-lg">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Monthly Expenses (6 mo)</h3>
            <div className="flex items-end gap-2 h-24">
              {monthlyTrends.map(m => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-gray-500">${Math.round(m.total)}</span>
                  <div className="w-full flex justify-center" style={{ height: `${Math.max((m.total / maxTotal) * 100, 4)}%` }}>
                    <div className="w-full max-w-8 bg-red-500 rounded-t" />
                  </div>
                  <span className="text-xs text-gray-500">{m.month.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Budget Alerts */}
      {categories.map(cat => {
        const budget = budgetMap[cat];
        const spent = monthSpendMap[cat] || 0;
        if (!budget || spent < budget * 0.8) return null;
        const pct = Math.round((spent / budget) * 100);
        return (
          <div key={cat} className={`mb-2 p-3 rounded-lg border text-sm ${spent >= budget ? 'bg-red-900/20 border-red-800 text-red-300' : 'bg-yellow-900/20 border-yellow-800 text-yellow-300'}`}>
            {cat}: ${spent.toFixed(0)} / ${budget.toFixed(0)} budget ({pct}%)
          </div>
        );
      })}

      {/* Budget Settings */}
      <form action={saveBudgetAction} className="mb-6 p-4 bg-gray-900 border border-gray-800 rounded-lg">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Monthly Budgets</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {categories.map(cat => (
            <div key={cat}>
              <label className="text-xs text-gray-500">{cat}</label>
              <input type="number" name={`budget_${cat}`} step="1" placeholder="No limit"
                defaultValue={budgetMap[cat] || ''}
                className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm" />
            </div>
          ))}
        </div>
        <button type="submit" className="mt-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs">Save Budgets</button>
      </form>

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
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-gray-800/50">
                  <td className="py-2 pr-4 text-white">{e.expense_date}</td>
                  <td className="py-2 pr-4 text-gray-300">{e.description}</td>
                  <td className="py-2 pr-4">
                    <span className="text-xs px-2 py-0.5 bg-gray-800 text-gray-400 rounded">{e.category}</span>
                  </td>
                  <td className="py-2 pr-4 text-gray-400">{e.client_name}</td>
                  <td className="py-2 text-right text-white">${e.amount.toFixed(2)}</td>
                  <td className="py-2 text-right">
                    <form action={deleteExpenseAction} className="inline">
                      <input type="hidden" name="id" value={e.id} />
                      <button type="submit" className="text-xs text-red-400 hover:text-red-300">Delete</button>
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
