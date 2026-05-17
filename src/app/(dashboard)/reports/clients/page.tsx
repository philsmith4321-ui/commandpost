import { getDb } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface ClientRevenue {
  id: number;
  name: string;
  status: string;
  total_revenue: number;
  invoice_count: number;
  avg_invoice: number;
  first_paid: string | null;
  last_paid: string | null;
  total_hours: number;
}

export default async function ClientRevenueReportPage() {
  const db = getDb();

  const clients = db.prepare(`
    SELECT
      c.id, c.name, c.status,
      COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.total_amount ELSE 0 END), 0) as total_revenue,
      COUNT(CASE WHEN i.status = 'paid' THEN 1 END) as invoice_count,
      COALESCE(AVG(CASE WHEN i.status = 'paid' THEN i.total_amount END), 0) as avg_invoice,
      MIN(CASE WHEN i.status = 'paid' THEN i.paid_at END) as first_paid,
      MAX(CASE WHEN i.status = 'paid' THEN i.paid_at END) as last_paid
    FROM clients c
    LEFT JOIN invoices i ON i.client_id = c.id
    WHERE c.deleted_at IS NULL
    GROUP BY c.id
    ORDER BY total_revenue DESC
  `).all() as ClientRevenue[];

  const hours = db.prepare(`
    SELECT p.client_id, COALESCE(SUM(te.duration_minutes), 0) as total_minutes
    FROM time_entries te
    JOIN projects p ON p.id = te.project_id
    GROUP BY p.client_id
  `).all() as { client_id: number; total_minutes: number }[];

  const hoursMap = new Map(hours.map(h => [h.client_id, h.total_minutes / 60]));
  const enriched = clients.map(c => ({ ...c, total_hours: hoursMap.get(c.id) || 0 }));
  const grandTotal = enriched.reduce((s, c) => s + c.total_revenue, 0);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Client Revenue Breakdown</h2>
        <Link href="/reports" className="text-sm text-gray-400 hover:text-white">&larr; Reports</Link>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-green-400">${grandTotal.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Clients with Revenue</p>
          <p className="text-2xl font-bold text-white">{enriched.filter(c => c.total_revenue > 0).length}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Avg per Client</p>
          <p className="text-2xl font-bold text-white">
            ${enriched.filter(c => c.total_revenue > 0).length > 0
              ? Math.round(grandTotal / enriched.filter(c => c.total_revenue > 0).length).toLocaleString()
              : '0'}
          </p>
        </div>
      </div>

      {/* Revenue distribution bar */}
      {grandTotal > 0 && (
        <div className="mb-6 p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Revenue Distribution</h3>
          <div className="flex rounded overflow-hidden h-6">
            {enriched.filter(c => c.total_revenue > 0).slice(0, 8).map((c, i) => {
              const pct = (c.total_revenue / grandTotal) * 100;
              const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-yellow-500', 'bg-pink-500', 'bg-cyan-500', 'bg-orange-500', 'bg-indigo-500'];
              return (
                <div key={c.id} className={`${colors[i]} relative group`} style={{ width: `${pct}%` }}>
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                    {c.name}: {pct.toFixed(1)}%
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 mt-2">
            {enriched.filter(c => c.total_revenue > 0).slice(0, 8).map((c, i) => {
              const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-yellow-500', 'bg-pink-500', 'bg-cyan-500', 'bg-orange-500', 'bg-indigo-500'];
              return (
                <span key={c.id} className="flex items-center gap-1 text-xs text-gray-400">
                  <span className={`w-2 h-2 rounded-full ${colors[i]}`} />
                  {c.name}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-left">
              <th className="p-3">Client</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Revenue</th>
              <th className="p-3 text-right">% of Total</th>
              <th className="p-3 text-right">Invoices</th>
              <th className="p-3 text-right">Avg Invoice</th>
              <th className="p-3 text-right">Hours</th>
              <th className="p-3 text-right">Eff. Rate</th>
              <th className="p-3">Last Paid</th>
            </tr>
          </thead>
          <tbody>
            {enriched.map(c => {
              const pct = grandTotal > 0 ? ((c.total_revenue / grandTotal) * 100).toFixed(1) : '0.0';
              const effRate = c.total_hours > 0 ? Math.round(c.total_revenue / c.total_hours) : null;
              return (
                <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="p-3">
                    <Link href={`/clients/${c.id}`} className="text-white hover:text-blue-400">{c.name}</Link>
                  </td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      c.status === 'active' ? 'bg-green-900/50 text-green-400' :
                      c.status === 'paused' ? 'bg-yellow-900/50 text-yellow-400' :
                      'bg-gray-800 text-gray-400'
                    }`}>{c.status}</span>
                  </td>
                  <td className="p-3 text-right text-green-400 font-medium">${c.total_revenue.toLocaleString()}</td>
                  <td className="p-3 text-right text-gray-400">{pct}%</td>
                  <td className="p-3 text-right text-white">{c.invoice_count}</td>
                  <td className="p-3 text-right text-gray-300">${Math.round(c.avg_invoice).toLocaleString()}</td>
                  <td className="p-3 text-right text-gray-300">{c.total_hours > 0 ? c.total_hours.toFixed(1) + 'h' : '—'}</td>
                  <td className="p-3 text-right text-gray-300">{effRate ? `$${effRate}/hr` : '—'}</td>
                  <td className="p-3 text-gray-400">{c.last_paid ? c.last_paid.slice(0, 10) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
