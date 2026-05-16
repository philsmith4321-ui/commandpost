import type { ClientHealth } from '@/lib/types';

const STATUS_COLORS = {
  healthy: { bg: 'bg-green-900/20', border: 'border-green-800', text: 'text-green-400', label: 'Healthy' },
  at_risk: { bg: 'bg-yellow-900/20', border: 'border-yellow-800', text: 'text-yellow-400', label: 'At Risk' },
  needs_attention: { bg: 'bg-red-900/20', border: 'border-red-800', text: 'text-red-400', label: 'Needs Attention' },
};

export function ClientHealthBadge({ health, showBreakdown = false }: { health: ClientHealth; showBreakdown?: boolean }) {
  const colors = STATUS_COLORS[health.status];

  return (
    <div className={`p-4 ${colors.bg} border ${colors.border} rounded-lg`}>
      <div className="flex items-center gap-3">
        <span className={`text-2xl font-bold ${colors.text}`}>{health.score}</span>
        <div>
          <span className={`text-sm font-medium ${colors.text}`}>{colors.label}</span>
          <p className="text-xs text-gray-500">Health Score</p>
        </div>
      </div>
      {showBreakdown && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-gray-500">Payment</p>
            <p className="text-white font-medium">{health.payment}/40</p>
          </div>
          <div>
            <p className="text-gray-500">Balance</p>
            <p className="text-white font-medium">{health.balance}/30</p>
          </div>
          <div>
            <p className="text-gray-500">Engagement</p>
            <p className="text-white font-medium">{health.engagement}/30</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function HealthDot({ status }: { status: ClientHealth['status'] }) {
  const dotColor = status === 'healthy' ? 'bg-green-400' : status === 'at_risk' ? 'bg-yellow-400' : 'bg-red-400';
  return <span className={`inline-block w-2 h-2 rounded-full ${dotColor}`} />;
}
