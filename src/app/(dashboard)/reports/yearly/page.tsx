import { getDb } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function YearlyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: yearParam } = await searchParams;
  const year = yearParam || String(new Date().getFullYear());
  const db = getDb();

  const revenue = (db.prepare(
    "SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'paid' AND strftime('%Y', paid_at) = ?"
  ).get(year) as any).total;
  const expenses = (db.prepare(
    "SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE strftime('%Y', expense_date) = ?"
  ).get(year) as any).total;
  const invoicesPaid = (db.prepare(
    "SELECT COUNT(*) as count FROM invoices WHERE status = 'paid' AND strftime('%Y', paid_at) = ?"
  ).get(year) as any).count;
  const invoicesSent = (db.prepare(
    "SELECT COUNT(*) as count FROM invoices WHERE sent_at IS NOT NULL AND strftime('%Y', sent_at) = ?"
  ).get(year) as any).count;
  const newClients = (db.prepare(
    "SELECT COUNT(*) as count FROM clients WHERE strftime('%Y', created_at) = ? AND deleted_at IS NULL"
  ).get(year) as any).count;
  const leadsCreated = (db.prepare(
    "SELECT COUNT(*) as count FROM leads WHERE strftime('%Y', created_at) = ?"
  ).get(year) as any).count;
  const leadsWon = (db.prepare(
    "SELECT COUNT(*) as count FROM leads WHERE stage = 'won' AND strftime('%Y', updated_at) = ?"
  ).get(year) as any).count;
  const totalMinutes = (db.prepare(
    "SELECT COALESCE(SUM(duration_minutes), 0) as total FROM time_entries WHERE strftime('%Y', entry_date) = ?"
  ).get(year) as any).total;
  const totalHours = totalMinutes / 60;
  const proposalsSent = (db.prepare(
    "SELECT COUNT(*) as count FROM proposals WHERE strftime('%Y', created_at) = ?"
  ).get(year) as any).count;
  const proposalsAccepted = (db.prepare(
    "SELECT COUNT(*) as count FROM proposals WHERE status = 'accepted' AND strftime('%Y', accepted_at) = ?"
  ).get(year) as any).count;

  const monthlyRevenue = db.prepare(
    "SELECT strftime('%m', paid_at) as month, SUM(total_amount) as total FROM invoices WHERE status = 'paid' AND strftime('%Y', paid_at) = ? GROUP BY strftime('%m', paid_at) ORDER BY month"
  ).all(year) as { month: string; total: number }[];

  const profit = revenue - expenses;
  const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;
  const effectiveRate = totalHours > 0 ? Math.round(revenue / totalHours) : 0;
  const years = [];
  for (let y = new Date().getFullYear(); y >= 2024; y--) years.push(String(y));

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">{year} Year in Review</h2>
        <div className="flex gap-2">
          {years.map(y => (
            <Link key={y} href={`/reports/yearly?year=${y}`}
              className={`px-3 py-1.5 text-sm rounded-lg ${y === year ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              {y}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Revenue</p>
          <p className="text-2xl font-bold text-green-400">${revenue.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Expenses</p>
          <p className="text-2xl font-bold text-red-400">${expenses.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Profit</p>
          <p className={`text-2xl font-bold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>${profit.toLocaleString()}</p>
          <p className="text-xs text-gray-500">{margin}% margin</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Effective Rate</p>
          <p className="text-2xl font-bold text-white">${effectiveRate}/hr</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Hours Worked</p>
          <p className="text-2xl font-bold text-white">{totalHours.toFixed(0)}h</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">New Clients</p>
          <p className="text-2xl font-bold text-white">{newClients}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Invoices Paid</p>
          <p className="text-2xl font-bold text-white">{invoicesPaid}/{invoicesSent}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Leads Won</p>
          <p className="text-2xl font-bold text-white">{leadsWon}/{leadsCreated}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Proposals</p>
          <p className="text-lg font-bold text-white">{proposalsAccepted} accepted / {proposalsSent} sent</p>
        </div>
      </div>

      {monthlyRevenue.length > 0 && (
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Monthly Revenue</h3>
          <div className="flex items-end gap-2 h-32">
            {Array.from({ length: 12 }, (_, i) => {
              const monthNum = String(i + 1).padStart(2, '0');
              const data = monthlyRevenue.find(m => m.month === monthNum);
              const amount = data?.total || 0;
              const maxAmount = Math.max(...monthlyRevenue.map(m => m.total), 1);
              const months = ['J','F','M','A','M','J','J','A','S','O','N','D'];
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  {amount > 0 && <span className="text-xs text-gray-500">${(amount / 1000).toFixed(1)}k</span>}
                  <div className="w-full bg-green-600/50 rounded-t" style={{ height: `${amount > 0 ? (amount / maxAmount) * 80 + 8 : 4}px` }} />
                  <span className="text-xs text-gray-600">{months[i]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
