import type { MonthlyRevenue } from '@/lib/queries/finance-queries';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function RevenueChart({ data }: { data: MonthlyRevenue[] }) {
  const maxAmount = Math.max(...data.map((d) => d.amount), 1);

  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold mb-4">Monthly Revenue (Last 12 Months)</h3>
      <div className="flex items-end gap-2 h-48">
        {data.map((d) => {
          const height = maxAmount > 0 ? (d.amount / maxAmount) * 100 : 0;
          const monthIndex = parseInt(d.month.split('-')[1], 10) - 1;
          return (
            <div key={d.month} className="flex-1 flex flex-col items-center">
              <span className="text-xs text-gray-400 mb-1">
                {d.amount > 0 ? `$${(d.amount / 1000).toFixed(d.amount >= 1000 ? 1 : 0)}k` : ''}
              </span>
              <div
                className="w-full bg-blue-600 rounded-t transition-all"
                style={{ height: `${Math.max(height, 2)}%` }}
                title={`${d.month}: $${d.amount.toLocaleString()}`}
              />
              <span className="text-xs text-gray-500 mt-1">{MONTH_LABELS[monthIndex]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
