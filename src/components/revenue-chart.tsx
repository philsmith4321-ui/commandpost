interface RevenueDataPoint {
  month: string;
  label?: string;
  amount: number;
}

function getLabel(point: RevenueDataPoint): string {
  if (point.label) return point.label;
  const [year, mon] = point.month.split('-');
  const d = new Date(Number(year), Number(mon) - 1);
  return d.toLocaleDateString('en-US', { month: 'short' });
}

export function RevenueChart({ data, title }: { data: RevenueDataPoint[]; title?: string }) {
  const max = Math.max(...data.map(d => d.amount), 1);

  return (
    <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
      <h3 className="text-sm font-medium text-gray-400 mb-4">{title || 'Revenue (Last 6 Months)'}</h3>
      <div className="flex items-end gap-2 h-32">
        {data.map((point) => {
          const height = Math.max((point.amount / max) * 100, 2);
          return (
            <div key={point.month} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs text-gray-500">
                {point.amount > 0 ? `$${point.amount >= 1000 ? Math.round(point.amount / 1000) + 'k' : point.amount}` : ''}
              </span>
              <div className="w-full flex justify-center flex-1" style={{ height: `${height}%` }}>
                <div className="w-full max-w-8 bg-blue-600 rounded-t" />
              </div>
              <span className="text-xs text-gray-500">{getLabel(point)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
