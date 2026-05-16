import Link from 'next/link';
import { getDb } from '@/lib/db';
import { listEndpoints } from '@/lib/queries/endpoint-queries';
import { getLastHealthCheck, getUptimePercent } from '@/lib/queries/health-check-queries';
import { getOpenIncident } from '@/lib/queries/incident-queries';
import { StatusDot } from '@/components/status-dot';
import type { DotColor } from '@/components/status-dot';
import { ExportButton } from '@/components/export-button';

export const dynamic = 'force-dynamic';

export default function OpsPage() {
  const db = getDb();
  const endpoints = listEndpoints(db);

  const rows = endpoints.map((ep) => {
    const lastCheck = getLastHealthCheck(db, ep.id);
    const openIncident = getOpenIncident(db, ep.id);
    const uptime = getUptimePercent(db, ep.id);

    let color: DotColor = 'green';
    if (openIncident) {
      color = 'red';
    } else if (lastCheck && lastCheck.is_healthy && lastCheck.response_time_ms > ep.slow_threshold_ms) {
      color = 'yellow';
    } else if (lastCheck && !lastCheck.is_healthy) {
      color = 'yellow';
    }

    return { ...ep, lastCheck, openIncident, uptime, color };
  });

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Ops Monitor</h2>
        <div className="flex items-center gap-2">
          <ExportButton href="/api/reports/uptime" label="Uptime Report" format="pdf" small />
          <Link href="/ops/new" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
            + Add Endpoint
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-500">No endpoints configured. Add one to start monitoring.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-800">
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">URL</th>
                <th className="pb-2 font-medium text-right">Response</th>
                <th className="pb-2 font-medium text-right">Uptime (30d)</th>
                <th className="pb-2 font-medium text-right">Last Check</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-gray-800 hover:bg-gray-900/50">
                  <td className="py-3"><StatusDot color={row.color} /></td>
                  <td className="py-3">
                    <Link href={`/ops/${row.id}`} className="text-white hover:text-blue-400">{row.name}</Link>
                  </td>
                  <td className="py-3 text-gray-400 text-xs font-mono truncate max-w-xs">{row.url}</td>
                  <td className="py-3 text-right text-gray-400">
                    {row.lastCheck ? `${row.lastCheck.response_time_ms}ms` : '—'}
                  </td>
                  <td className="py-3 text-right text-gray-400">{row.uptime.toFixed(1)}%</td>
                  <td className="py-3 text-right text-gray-500 text-xs">
                    {row.lastCheck
                      ? new Date(row.lastCheck.checked_at + 'Z').toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                      : 'Never'}
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
