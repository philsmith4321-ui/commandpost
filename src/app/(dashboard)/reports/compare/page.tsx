import Link from 'next/link';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface ClientComparison {
  id: number;
  name: string;
  status: string;
  monthly_value: number | null;
  revenue: number;
  invoiceCount: number;
  hours: string;
  projects: number;
  meetings: number;
  nps: number | null;
  effectiveRate: number | null;
}

export default async function CompareClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const sp = await searchParams;
  const db = getDb();
  const allClients = db.prepare("SELECT id, name FROM clients WHERE deleted_at IS NULL ORDER BY name").all() as { id: number; name: string }[];

  const selectedIds = sp.ids ? sp.ids.split(',').map(Number).filter(Boolean) : [];

  const compareData = selectedIds.map((id): ClientComparison | null => {
    const client = db.prepare("SELECT id, name, status, monthly_value FROM clients WHERE id = ?").get(id) as { id: number; name: string; status: string; monthly_value: number | null } | undefined;
    if (!client) return null;

    const revenue = (db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE client_id = ? AND status = 'paid'").get(id) as { total: number }).total;
    const invoiceCount = (db.prepare("SELECT COUNT(*) as count FROM invoices WHERE client_id = ? AND status = 'paid'").get(id) as { count: number }).count;
    const hours = (db.prepare("SELECT COALESCE(SUM(te.duration_minutes), 0) as total FROM time_entries te JOIN projects p ON p.id = te.project_id WHERE p.client_id = ?").get(id) as { total: number }).total / 60;
    const projects = (db.prepare("SELECT COUNT(*) as count FROM projects WHERE client_id = ?").get(id) as { count: number }).count;
    const meetings = (db.prepare("SELECT COUNT(*) as count FROM meetings WHERE client_id = ?").get(id) as { count: number }).count;
    const latestScore = db.prepare("SELECT score FROM satisfaction_scores WHERE client_id = ? ORDER BY scored_at DESC LIMIT 1").get(id) as { score: number } | undefined;
    const effectiveRate = hours > 0 ? Math.round(revenue / hours) : null;

    return {
      ...client,
      revenue,
      invoiceCount,
      hours: hours.toFixed(1),
      projects,
      meetings,
      nps: latestScore?.score ?? null,
      effectiveRate,
    };
  }).filter((c): c is ClientComparison => c !== null);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Compare Clients</h2>
        <Link href="/reports" className="text-sm text-gray-400 hover:text-white">&larr; Reports</Link>
      </div>

      {/* Client Selector */}
      <form className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-gray-900 border border-gray-800 rounded-lg">
        <span className="text-sm text-gray-400">Select clients:</span>
        <select name="ids" multiple className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm h-24 min-w-[200px]">
          {allClients.map(c => (
            <option key={c.id} value={c.id} selected={selectedIds.includes(c.id)}>{c.name}</option>
          ))}
        </select>
        <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg">Compare</button>
        <p className="text-xs text-gray-500 w-full mt-1">Hold Cmd/Ctrl to select multiple clients</p>
      </form>

      {compareData.length >= 2 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-500">
                <th className="p-3 font-medium">Metric</th>
                {compareData.map((c) => (
                  <th key={c.id} className="p-3 font-medium text-white">{c.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-800/50">
                <td className="p-3 text-gray-400">Status</td>
                {compareData.map((c) => (
                  <td key={c.id} className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      c.status === 'active' ? 'bg-green-900/50 text-green-400' :
                      c.status === 'paused' ? 'bg-yellow-900/50 text-yellow-400' :
                      'bg-gray-800 text-gray-400'
                    }`}>{c.status}</span>
                  </td>
                ))}
              </tr>
              <tr className="border-b border-gray-800/50">
                <td className="p-3 text-gray-400">Total Revenue</td>
                {compareData.map((c) => (
                  <td key={c.id} className="p-3 text-green-400 font-medium">${c.revenue.toLocaleString()}</td>
                ))}
              </tr>
              <tr className="border-b border-gray-800/50">
                <td className="p-3 text-gray-400">Invoices Paid</td>
                {compareData.map((c) => (
                  <td key={c.id} className="p-3 text-white">{c.invoiceCount}</td>
                ))}
              </tr>
              <tr className="border-b border-gray-800/50">
                <td className="p-3 text-gray-400">Hours Logged</td>
                {compareData.map((c) => (
                  <td key={c.id} className="p-3 text-white">{c.hours}h</td>
                ))}
              </tr>
              <tr className="border-b border-gray-800/50">
                <td className="p-3 text-gray-400">Effective Rate</td>
                {compareData.map((c) => (
                  <td key={c.id} className="p-3 text-white">{c.effectiveRate ? `$${c.effectiveRate}/hr` : '—'}</td>
                ))}
              </tr>
              <tr className="border-b border-gray-800/50">
                <td className="p-3 text-gray-400">Projects</td>
                {compareData.map((c) => (
                  <td key={c.id} className="p-3 text-white">{c.projects}</td>
                ))}
              </tr>
              <tr className="border-b border-gray-800/50">
                <td className="p-3 text-gray-400">Meetings</td>
                {compareData.map((c) => (
                  <td key={c.id} className="p-3 text-white">{c.meetings}</td>
                ))}
              </tr>
              <tr className="border-b border-gray-800/50">
                <td className="p-3 text-gray-400">NPS Score</td>
                {compareData.map((c) => (
                  <td key={c.id} className={`p-3 font-medium ${
                    c.nps === null ? 'text-gray-500' :
                    c.nps >= 9 ? 'text-green-400' :
                    c.nps >= 7 ? 'text-yellow-400' : 'text-red-400'
                  }`}>{c.nps !== null ? c.nps : '—'}</td>
                ))}
              </tr>
              <tr>
                <td className="p-3 text-gray-400">Monthly Value</td>
                {compareData.map((c) => (
                  <td key={c.id} className="p-3 text-white">{c.monthly_value ? `$${c.monthly_value.toLocaleString()}` : '—'}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {compareData.length < 2 && selectedIds.length > 0 && (
        <p className="text-sm text-gray-500">Select at least 2 clients to compare.</p>
      )}
    </div>
  );
}
