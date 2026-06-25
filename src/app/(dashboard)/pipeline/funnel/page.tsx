import Link from 'next/link';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default function FunnelPage() {
  const db = getDb();

  const stages = ['new', 'contacted', 'discovery', 'proposal', 'negotiating', 'won', 'lost'] as const;
  const stageCounts: Record<string, number> = {};
  for (const stage of stages) {
    stageCounts[stage] = (db.prepare('SELECT COUNT(*) as count FROM leads WHERE stage = ?').get(stage) as { count: number }).count;
  }

  // Historical conversion: how many leads passed through each stage
  const stageHistoryCounts: Record<string, number> = {};
  for (const stage of stages) {
    stageHistoryCounts[stage] = (db.prepare(
      'SELECT COUNT(DISTINCT lead_id) as count FROM lead_stage_history WHERE stage = ?'
    ).get(stage) as { count: number }).count;
  }

  const totalLeads = (db.prepare('SELECT COUNT(*) as count FROM leads').get() as { count: number }).count;
  const wonCount = stageCounts['won'] || 0;
  const lostCount = stageCounts['lost'] || 0;
  const overallConversion = totalLeads > 0 ? Math.round((wonCount / totalLeads) * 100) : 0;

  // Lost reasons breakdown
  const lostReasons = db.prepare(
    "SELECT lost_reason, COUNT(*) as count FROM leads WHERE stage = 'lost' AND lost_reason IS NOT NULL GROUP BY lost_reason ORDER BY count DESC"
  ).all() as { lost_reason: string; count: number }[];

  // Avg time to convert (won leads)
  const avgConversion = db.prepare(`
    SELECT AVG(julianday(h2.entered_at) - julianday(h1.entered_at)) as avg_days
    FROM lead_stage_history h1
    JOIN lead_stage_history h2 ON h1.lead_id = h2.lead_id
    WHERE h1.stage = 'new' AND h2.stage = 'won'
  `).get() as { avg_days: number | null } | undefined;
  const avgDays = avgConversion?.avg_days ? Math.round(avgConversion.avg_days) : null;

  const funnelStages = ['new', 'contacted', 'discovery', 'proposal', 'negotiating'] as const;
  const maxHistory = Math.max(...funnelStages.map(s => stageHistoryCounts[s] || 0), 1);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Pipeline Funnel</h2>
        <Link href="/pipeline" className="text-sm text-gray-400 hover:text-white">&larr; Back to Pipeline</Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Total Leads</p>
          <p className="text-2xl font-bold text-white">{totalLeads}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Won</p>
          <p className="text-2xl font-bold text-green-400">{wonCount}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Conversion Rate</p>
          <p className="text-2xl font-bold text-white">{overallConversion}%</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Avg Days to Close</p>
          <p className="text-2xl font-bold text-white">{avgDays !== null ? `${avgDays}d` : '—'}</p>
        </div>
      </div>

      {/* Funnel visualization */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Conversion Funnel</h3>
        <div className="space-y-2">
          {funnelStages.map((stage, i) => {
            const count = stageHistoryCounts[stage] || 0;
            const width = maxHistory > 0 ? (count / maxHistory) * 100 : 0;
            const nextStage = funnelStages[i + 1];
            const nextCount = nextStage ? stageHistoryCounts[nextStage] || 0 : wonCount;
            const dropoff = count > 0 ? Math.round(((count - nextCount) / count) * 100) : 0;

            return (
              <div key={stage} className="flex items-center gap-3">
                <span className="w-24 text-sm text-gray-400 text-right capitalize">{stage}</span>
                <div className="flex-1 relative">
                  <div className="h-8 bg-blue-600/30 rounded" style={{ width: `${Math.max(width, 4)}%` }}>
                    <div className="h-full bg-blue-600 rounded flex items-center px-3" style={{ width: `${Math.max((count / Math.max(maxHistory, 1)) * 100, 4)}%` }}>
                      <span className="text-xs text-white font-medium">{count}</span>
                    </div>
                  </div>
                </div>
                {i < funnelStages.length - 1 && dropoff > 0 && (
                  <span className="text-xs text-red-400 w-16">-{dropoff}%</span>
                )}
              </div>
            );
          })}
          <div className="flex items-center gap-3">
            <span className="w-24 text-sm text-green-400 text-right font-medium">Won</span>
            <div className="flex-1">
              <div className="h-8 bg-green-600 rounded flex items-center px-3" style={{ width: `${Math.max((wonCount / Math.max(maxHistory, 1)) * 100, 4)}%` }}>
                <span className="text-xs text-white font-medium">{wonCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lost reasons */}
      {lostReasons.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Lost Reasons ({lostCount} total)</h3>
          <div className="space-y-2">
            {lostReasons.map(r => (
              <div key={r.lost_reason} className="flex items-center justify-between p-3 bg-gray-900 border border-gray-800 rounded-lg">
                <span className="text-sm text-gray-300 capitalize">{r.lost_reason.replace(/_/g, ' ')}</span>
                <span className="text-sm text-red-400">{r.count} ({lostCount > 0 ? Math.round((r.count / lostCount) * 100) : 0}%)</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
