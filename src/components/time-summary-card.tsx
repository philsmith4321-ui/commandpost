import type { ProjectTimeSummary } from '@/lib/queries/time-queries';

interface TimeSummaryCardProps {
  summary: ProjectTimeSummary;
}

export function TimeSummaryCard({ summary }: TimeSummaryCardProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
        <p className="text-xs text-gray-500 uppercase mb-1">Total Hours</p>
        <p className="text-xl font-bold text-white">{summary.totalHours.toFixed(1)}h</p>
      </div>
      <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
        <p className="text-xs text-gray-500 uppercase mb-1">Total Cost</p>
        <p className="text-xl font-bold text-white">${summary.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
      </div>
      <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
        <p className="text-xs text-gray-500 uppercase mb-1">Uninvoiced Hours</p>
        <p className="text-xl font-bold text-yellow-400">{summary.uninvoicedHours.toFixed(1)}h</p>
      </div>
      <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
        <p className="text-xs text-gray-500 uppercase mb-1">Uninvoiced Amount</p>
        <p className="text-xl font-bold text-yellow-400">${summary.uninvoicedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
      </div>
    </div>
  );
}
