import { getDb } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function PnlReportPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const startDefault = `${now.getFullYear()}-01-01`;
  const endDefault = now.toISOString().split('T')[0];
  const start = sp.start || startDefault;
  const end = sp.end || endDefault;
  const db = getDb();

  const revenue = (db.prepare(
    "SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'paid' AND paid_at >= ? AND paid_at <= ?"
  ).get(start, end + 'T23:59:59') as { total: number }).total;

  const invoiceCount = (db.prepare(
    "SELECT COUNT(*) as count FROM invoices WHERE status = 'paid' AND paid_at >= ? AND paid_at <= ?"
  ).get(start, end + 'T23:59:59') as { count: number }).count;

  const expensesByCategory = db.prepare(
    "SELECT category, SUM(amount) as total, COUNT(*) as count FROM expenses WHERE expense_date >= ? AND expense_date <= ? GROUP BY category ORDER BY total DESC"
  ).all(start, end) as { category: string; total: number; count: number }[];

  const totalExpenses = expensesByCategory.reduce((s, e) => s + e.total, 0);
  const profit = revenue - totalExpenses;
  const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

  const monthlyIncome = db.prepare(
    "SELECT strftime('%Y-%m', paid_at) as month, SUM(total_amount) as total FROM invoices WHERE status = 'paid' AND paid_at >= ? AND paid_at <= ? GROUP BY month ORDER BY month"
  ).all(start, end + 'T23:59:59') as { month: string; total: number }[];

  const monthlyExpenses = db.prepare(
    "SELECT strftime('%Y-%m', expense_date) as month, SUM(amount) as total FROM expenses WHERE expense_date >= ? AND expense_date <= ? GROUP BY month ORDER BY month"
  ).all(start, end) as { month: string; total: number }[];

  const allMonths = new Set([...monthlyIncome.map(m => m.month), ...monthlyExpenses.map(m => m.month)]);
  const monthlyData = Array.from(allMonths).sort().map(month => ({
    month,
    income: monthlyIncome.find(m => m.month === month)?.total || 0,
    expenses: monthlyExpenses.find(m => m.month === month)?.total || 0,
  }));

  const categoryLabels: Record<string, string> = {
    servers: 'Servers & Hosting',
    software: 'Software & Tools',
    contractor: 'Contractors',
    marketing: 'Marketing',
    other: 'Other',
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Profit & Loss Statement</h2>
        <Link href="/reports" className="text-sm text-gray-400 hover:text-white">&larr; Reports</Link>
      </div>

      <form className="flex items-center gap-3 mb-6">
        <input type="date" name="start" defaultValue={start} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
        <span className="text-gray-500">to</span>
        <input type="date" name="end" defaultValue={end} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
        <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg">Apply</button>
      </form>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Income</p>
          <p className="text-2xl font-bold text-green-400">${revenue.toLocaleString()}</p>
          <p className="text-xs text-gray-500">{invoiceCount} invoices</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Expenses</p>
          <p className="text-2xl font-bold text-red-400">${totalExpenses.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Net Profit</p>
          <p className={`text-2xl font-bold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ${profit.toLocaleString()}
          </p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Margin</p>
          <p className={`text-2xl font-bold ${margin >= 0 ? 'text-white' : 'text-red-400'}`}>{margin}%</p>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden mb-8">
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-gray-800 bg-gray-800/50">
              <td className="p-3 font-semibold text-white" colSpan={2}>INCOME</td>
            </tr>
            <tr className="border-b border-gray-800/50">
              <td className="p-3 pl-6 text-gray-300">Paid Invoices</td>
              <td className="p-3 text-right text-green-400 font-medium">${revenue.toLocaleString()}</td>
            </tr>
            <tr className="border-b border-gray-800 bg-gray-800/30">
              <td className="p-3 font-medium text-white">Total Income</td>
              <td className="p-3 text-right text-green-400 font-bold">${revenue.toLocaleString()}</td>
            </tr>
            <tr className="border-b border-gray-800 bg-gray-800/50">
              <td className="p-3 font-semibold text-white" colSpan={2}>EXPENSES</td>
            </tr>
            {expensesByCategory.map(cat => (
              <tr key={cat.category} className="border-b border-gray-800/50">
                <td className="p-3 pl-6 text-gray-300">{categoryLabels[cat.category] || cat.category}</td>
                <td className="p-3 text-right text-red-400">${cat.total.toLocaleString()}</td>
              </tr>
            ))}
            {expensesByCategory.length === 0 && (
              <tr className="border-b border-gray-800/50">
                <td className="p-3 pl-6 text-gray-500" colSpan={2}>No expenses recorded</td>
              </tr>
            )}
            <tr className="border-b border-gray-800 bg-gray-800/30">
              <td className="p-3 font-medium text-white">Total Expenses</td>
              <td className="p-3 text-right text-red-400 font-bold">${totalExpenses.toLocaleString()}</td>
            </tr>
            <tr className="bg-gray-800/50">
              <td className="p-3 font-bold text-white text-lg">NET PROFIT</td>
              <td className={`p-3 text-right font-bold text-lg ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${profit.toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {monthlyData.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Monthly Breakdown</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500">
                <th className="p-2 text-left">Month</th>
                <th className="p-2 text-right">Income</th>
                <th className="p-2 text-right">Expenses</th>
                <th className="p-2 text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.map(m => {
                const net = m.income - m.expenses;
                return (
                  <tr key={m.month} className="border-b border-gray-800/50">
                    <td className="p-2 text-white">{m.month}</td>
                    <td className="p-2 text-right text-green-400">${m.income.toLocaleString()}</td>
                    <td className="p-2 text-right text-red-400">${m.expenses.toLocaleString()}</td>
                    <td className={`p-2 text-right font-medium ${net >= 0 ? 'text-white' : 'text-red-400'}`}>
                      ${net.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
