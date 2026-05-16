import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getEndpointById } from '@/lib/queries/endpoint-queries';
import { getLastHealthCheck, getUptimePercent, getAvgResponseTime24h, getHealthChecks24h } from '@/lib/queries/health-check-queries';
import { getOpenIncident, listIncidents, getTotalIncidentCount } from '@/lib/queries/incident-queries';
import { deleteEndpointAction } from '@/lib/actions/endpoint-actions';
import { StatusDot } from '@/components/status-dot';
import { ResponseTimeChart } from '@/components/response-time-chart';
import type { DotColor } from '@/components/status-dot';

export const dynamic = 'force-dynamic';

export default async function EndpointDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const endpoint = getEndpointById(db, Number(id));

  if (!endpoint) notFound();

  const lastCheck = getLastHealthCheck(db, endpoint.id);
  const openIncident = getOpenIncident(db, endpoint.id);
  const uptime = getUptimePercent(db, endpoint.id);
  const avgResponse = getAvgResponseTime24h(db, endpoint.id);
  const totalIncidents = getTotalIncidentCount(db, endpoint.id);
  const checks24h = getHealthChecks24h(db, endpoint.id);
  const incidents = listIncidents(db, endpoint.id);

  let color: DotColor = 'green';
  if (openIncident) {
    color = 'red';
  } else if (lastCheck && lastCheck.is_healthy && lastCheck.response_time_ms > endpoint.slow_threshold_ms) {
    color = 'yellow';
  }

  return (
    <div className="p-4 sm:p-6">
      <Link href="/ops" className="text-sm text-gray-400 hover:text-white mb-4 inline-block">
        &larr; Back to Ops
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <StatusDot color={color} />
        <h2 className="text-2xl font-bold">{endpoint.name}</h2>
        <span className="text-sm text-gray-400 font-mono">{endpoint.url}</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-6">
        <Link href={`/ops/${endpoint.id}/edit`} className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white hover:bg-gray-700">
          Edit
        </Link>
        <form action={deleteEndpointAction}>
          <input type="hidden" name="id" value={endpoint.id} />
          <button type="submit" className="px-3 py-1.5 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-400 hover:bg-red-900/50">
            Delete
          </button>
        </form>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Uptime (30d)</p>
          <p className="text-2xl font-bold text-white">{uptime.toFixed(1)}%</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Avg Response (24h)</p>
          <p className="text-2xl font-bold text-white">{avgResponse}ms</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Total Incidents</p>
          <p className="text-2xl font-bold text-white">{totalIncidents}</p>
        </div>
      </div>

      {/* Response Time Chart */}
      <ResponseTimeChart checks={checks24h} />

      {/* Incident History */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Incident History</h3>
        {incidents.length === 0 ? (
          <p className="text-sm text-gray-500">No incidents recorded.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-800">
                <th className="pb-2 font-medium">Started</th>
                <th className="pb-2 font-medium">Resolved</th>
                <th className="pb-2 font-medium text-right">Duration</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc) => (
                <tr key={inc.id} className="border-b border-gray-800">
                  <td className="py-2 text-gray-400">
                    {new Date(inc.started_at + 'Z').toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </td>
                  <td className="py-2 text-gray-400">
                    {inc.resolved_at
                      ? new Date(inc.resolved_at + 'Z').toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                      : <span className="text-red-400">Ongoing</span>}
                  </td>
                  <td className="py-2 text-right text-gray-400">
                    {inc.duration_seconds != null ? formatDuration(inc.duration_seconds) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}
