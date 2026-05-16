import Link from 'next/link';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface MonthlyPnL {
  month: string;
  label: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export default function PnLPage() {
  const db = getDb();

  // Last 12 months
  const months: MonthlyPnL[] = [];
  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
    const monthStart = `${month}-01`;

    const revenue = (db.prepare(
      "SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'paid' AND paid_at >= ? AND paid_at <= ?"
    ).get(monthStart, monthEnd) as any).total;

    const expenses = (db.prepare(
      "SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE expense_date >= ? AND expense_date <= ?"
    ).get(monthStart, monthEnd) as any).total;

    months.push({ month, label, revenue, expenses, profit: revenue - expenses });
  }

  const totalRevenue = months.reduce((s, m) => s + m.revenue, 0);
  const totalExpenses = months.reduce((s, m) => s + m.expenses, 0);
  const totalProfit = totalRevenue - totalExpenses;
  const margin = totalRevenue > 0 ? (totalProfit / totalRevenue * 100) : 0;

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Profit & Loss</h1>
        <Link href="/reports" className="text-sm text-gray-400 hover:text-white">← Reports</Link>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase">Total Revenue</p>
          <p className="text-xl font-bold text-green-400">${totalRevenue.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase">Total Expenses</p>
          <p className="text-xl font-bold text-red-400">${totalExpenses.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase">Net Profit</p>
          <p className={`text-xl font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>${totalProfit.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase">Margin</p>
          <p className="text-xl font-bold text-white">{margin.toFixed(1)}%</p>
        </div>
      </div>

      {/* Monthly Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-left">
              <th className="pb-2 pr-4">Month</th>
              <th className="pb-2 pr-4 text-right">Revenue</th>
              <th className="pb-2 pr-4 text-right">Expenses</th>
              <th className="pb-2 text-right">Profit</th>
            </tr>
          </thead>
          <tbody>
            {months.map(m => (
              <tr key={m.month} className="border-b border-gray-800/50">
                <td className="py-2 pr-4 text-white">{m.label}</td>
                <td className="py-2 pr-4 text-right text-green-400">${m.revenue.toLocaleString()}</td>
                <td className="py-2 pr-4 text-right text-red-400">${m.expenses.toLocaleString()}</td>
                <td className={`py-2 text-right font-medium ${m.profit >= 0 ? 'text-white' : 'text-red-400'}`}>
                  ${m.profit.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-700">
              <td className="py-2 pr-4 font-bold text-white">Total</td>
              <td className="py-2 pr-4 text-right font-bold text-green-400">${totalRevenue.toLocaleString()}</td>
              <td className="py-2 pr-4 text-right font-bold text-red-400">${totalExpenses.toLocaleString()}</td>
              <td className={`py-2 text-right font-bold ${totalProfit >= 0 ? 'text-white' : 'text-red-400'}`}>
                ${totalProfit.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
