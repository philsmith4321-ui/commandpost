import type { DiskReport } from '@/lib/types';

function barColor(percent: number): string {
  if (percent >= 85) return 'bg-red-500';
  if (percent >= 70) return 'bg-yellow-500';
  return 'bg-green-500';
}

export function DiskUsageBar({ report }: { report: DiskReport }) {
  return (
    <div className="p-3 bg-gray-900 border border-gray-800 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-white font-mono">{report.mount_point}</span>
        <span className="text-xs text-gray-400">
          {report.used_gb.toFixed(1)} / {report.total_gb.toFixed(1)} GB ({report.percent_used.toFixed(1)}%)
        </span>
      </div>
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor(report.percent_used)}`}
          style={{ width: `${Math.min(report.percent_used, 100)}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-1">
        Last reported: {new Date(report.reported_at + 'Z').toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
      </p>
    </div>
  );
}
