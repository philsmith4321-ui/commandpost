import type { HealthCheck } from '@/lib/types';

export function ResponseTimeChart({ checks }: { checks: HealthCheck[] }) {
  if (checks.length === 0) {
    return <p className="text-sm text-gray-500">No health checks in the last 24 hours.</p>;
  }

  const maxMs = Math.max(...checks.map(c => c.response_time_ms), 1);

  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold mb-4">Response Time (Last 24 Hours)</h3>
      <div className="flex items-end gap-px h-48">
        {checks.map((check) => {
          const height = (check.response_time_ms / maxMs) * 100;
          const barColor = check.is_healthy ? 'bg-blue-600' : 'bg-red-600';
          const time = new Date(check.checked_at + 'Z');
          const label = time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
          return (
            <div
              key={check.id}
              className="flex-1 flex flex-col items-center justify-end h-full"
            >
              <div
                className={`w-full ${barColor} rounded-t transition-all min-h-[2px]`}
                style={{ height: `${Math.max(height, 1)}%` }}
                title={`${label}: ${check.response_time_ms}ms ${check.is_healthy ? '' : '(unhealthy)'}`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs text-gray-500">
          {checks.length > 0 ? new Date(checks[0].checked_at + 'Z').toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}
        </span>
        <span className="text-xs text-gray-500">
          {checks.length > 0 ? new Date(checks[checks.length - 1].checked_at + 'Z').toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}
        </span>
      </div>
    </div>
  );
}
