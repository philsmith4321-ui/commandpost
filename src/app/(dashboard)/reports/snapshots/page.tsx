import { getDb } from '@/lib/db';
import { getAllMetricNames, getSnapshotHistory } from '@/lib/queries/snapshot-queries';

export const dynamic = 'force-dynamic';

export default function SnapshotsPage() {
  const db = getDb();
  const metrics = getAllMetricNames(db);

  const histories: Record<string, { value: number; date: string }[]> = {};
  for (const m of metrics) {
    histories[m] = getSnapshotHistory(db, m, 30).reverse().map(s => ({ value: s.metric_value, date: s.snapshot_date }));
  }

  const formatMetric = (name: string, value: number) => {
    if (['mrr', 'outstanding', 'overdue', 'pipeline_value', 'monthly_revenue'].includes(name)) {
      return `$${value.toLocaleString()}`;
    }
    return value.toLocaleString();
  };

  return (
    <div className="p-4 sm:p-6">
      <h2 className="text-2xl font-bold mb-2">Metric Snapshots</h2>
      <p className="text-sm text-gray-500 mb-6">
        Daily snapshots captured via <code className="text-xs bg-gray-800 px-1 rounded">/api/cron/snapshots</code>
      </p>

      {metrics.length === 0 ? (
        <p className="text-gray-500">No snapshots yet. Call the cron endpoint to start capturing data.</p>
      ) : (
        <div className="space-y-6">
          {metrics.map(metric => {
            const history = histories[metric] || [];
            const latest = history[history.length - 1];
            const prev = history[history.length - 2];
            const change = latest && prev ? latest.value - prev.value : null;

            return (
              <div key={metric} className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-white">{metric.replace(/_/g, ' ')}</h3>
                  <div className="flex items-center gap-2">
                    {latest && <span className="text-lg font-bold text-white">{formatMetric(metric, latest.value)}</span>}
                    {change !== null && change !== 0 && (
                      <span className={`text-xs ${change > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {change > 0 ? '+' : ''}{formatMetric(metric, change)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Sparkline */}
                {history.length > 1 && (() => {
                  const max = Math.max(...history.map(h => h.value));
                  const min = Math.min(...history.map(h => h.value));
                  const range = max - min || 1;
                  return (
                    <div className="flex items-end gap-0.5 h-8">
                      {history.map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 bg-blue-600/50 rounded-t"
                          style={{ height: `${Math.max(4, ((h.value - min) / range) * 100)}%` }}
                          title={`${h.date}: ${formatMetric(metric, h.value)}`}
                        />
                      ))}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
