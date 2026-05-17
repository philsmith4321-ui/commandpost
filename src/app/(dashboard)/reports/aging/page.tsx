import Link from 'next/link';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface AgingInvoice {
  id: number;
  invoice_number: string;
  client_name: string;
  client_id: number;
  total_amount: number;
  due_date: string;
  days_overdue: number;
  sent_at: string | null;
}

export default function AgingReportPage() {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  const invoices = db.prepare(`
    SELECT i.id, i.invoice_number, c.name as client_name, c.id as client_id,
      i.total_amount, i.due_date, i.sent_at,
      CAST(julianday(?) - julianday(i.due_date) AS INTEGER) as days_overdue
    FROM invoices i
    JOIN clients c ON c.id = i.client_id
    WHERE i.status = 'sent'
    ORDER BY i.due_date ASC
  `).all(today) as AgingInvoice[];

  const buckets = [
    { label: 'Current', min: -9999, max: 0, color: 'text-green-400', bg: 'bg-green-900/20 border-green-800' },
    { label: '1-30 Days', min: 1, max: 30, color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-800' },
    { label: '31-60 Days', min: 31, max: 60, color: 'text-orange-400', bg: 'bg-orange-900/20 border-orange-800' },
    { label: '61-90 Days', min: 61, max: 90, color: 'text-red-400', bg: 'bg-red-900/20 border-red-800' },
    { label: '90+ Days', min: 91, max: 9999, color: 'text-red-500', bg: 'bg-red-900/30 border-red-700' },
  ];

  const grouped = buckets.map(bucket => ({
    ...bucket,
    invoices: invoices.filter(i => i.days_overdue >= bucket.min && i.days_overdue <= bucket.max),
    total: invoices.filter(i => i.days_overdue >= bucket.min && i.days_overdue <= bucket.max).reduce((s, i) => s + i.total_amount, 0),
  }));

  const totalOutstanding = invoices.reduce((s, i) => s + i.total_amount, 0);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Invoice Aging Report</h2>
        <Link href="/reports" className="text-sm text-gray-400 hover:text-white">&larr; Reports</Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
        {grouped.map(b => (
          <div key={b.label} className={`p-4 border rounded-lg ${b.bg}`}>
            <p className="text-xs text-gray-500 uppercase mb-1">{b.label}</p>
            <p className={`text-xl font-bold ${b.color}`}>${b.total.toLocaleString()}</p>
            <p className="text-xs text-gray-500">{b.invoices.length} invoice{b.invoices.length !== 1 ? 's' : ''}</p>
          </div>
        ))}
      </div>

      <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg mb-8">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-400">Total Outstanding</span>
          <span className="text-xl font-bold text-white">${totalOutstanding.toLocaleString()}</span>
        </div>
        {totalOutstanding > 0 && (
          <div className="flex rounded overflow-hidden h-3 mt-3">
            {grouped.filter(b => b.total > 0).map(b => {
              const pct = (b.total / totalOutstanding) * 100;
              const barColors: Record<string, string> = {
                'Current': 'bg-green-500',
                '1-30 Days': 'bg-yellow-500',
                '31-60 Days': 'bg-orange-500',
                '61-90 Days': 'bg-red-500',
                '90+ Days': 'bg-red-700',
              };
              return <div key={b.label} className={barColors[b.label] || 'bg-gray-500'} style={{ width: `${pct}%` }} title={`${b.label}: $${b.total.toLocaleString()}`} />;
            })}
          </div>
        )}
      </div>

      {grouped.filter(b => b.invoices.length > 0).map(bucket => (
        <div key={bucket.label} className="mb-6">
          <h3 className={`text-sm font-medium ${bucket.color} mb-2`}>{bucket.label} ({bucket.invoices.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-left">
                  <th className="p-2 font-medium">Invoice</th>
                  <th className="p-2 font-medium">Client</th>
                  <th className="p-2 font-medium text-right">Amount</th>
                  <th className="p-2 font-medium">Due Date</th>
                  <th className="p-2 font-medium text-right">Days Overdue</th>
                </tr>
              </thead>
              <tbody>
                {bucket.invoices.map(inv => (
                  <tr key={inv.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="p-2">
                      <Link href={`/finances/invoices/${inv.id}`} className="text-blue-400 hover:text-blue-300">{inv.invoice_number}</Link>
                    </td>
                    <td className="p-2">
                      <Link href={`/clients/${inv.client_id}`} className="text-white hover:text-blue-400">{inv.client_name}</Link>
                    </td>
                    <td className="p-2 text-right text-white font-medium">${inv.total_amount.toLocaleString()}</td>
                    <td className="p-2 text-gray-400">{inv.due_date}</td>
                    <td className={`p-2 text-right ${inv.days_overdue > 0 ? bucket.color : 'text-green-400'}`}>
                      {inv.days_overdue > 0 ? inv.days_overdue : 'Current'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {invoices.length === 0 && (
        <p className="text-sm text-gray-500">No outstanding invoices.</p>
      )}
    </div>
  );
}
