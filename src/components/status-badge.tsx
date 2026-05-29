const colors: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400',
  paused: 'bg-yellow-500/20 text-yellow-400',
  completed: 'bg-gray-500/20 text-gray-400',
  'on-hold': 'bg-yellow-500/20 text-yellow-400',
  not_started: 'bg-gray-500/20 text-gray-400',
  in_progress: 'bg-blue-500/20 text-blue-400',
  delivered: 'bg-green-500/20 text-green-400',
  overdue: 'bg-red-500/20 text-red-400',
  draft: 'bg-gray-500/20 text-gray-400',
  sent: 'bg-blue-500/20 text-blue-400',
  paid: 'bg-green-500/20 text-green-400',
  servers: 'bg-purple-500/20 text-purple-400',
  software: 'bg-cyan-500/20 text-cyan-400',
  contractor: 'bg-orange-500/20 text-orange-400',
  marketing: 'bg-pink-500/20 text-pink-400',
  other: 'bg-gray-500/20 text-gray-400',
  scheduled: 'bg-blue-500/20 text-blue-400',
  posted: 'bg-green-500/20 text-green-400',
  archived: 'bg-gray-500/20 text-gray-400',
};

export function StatusBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, ' ').replace(/-/g, ' ');
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${colors[status] || 'bg-gray-500/20 text-gray-400'}`}
    >
      {label}
    </span>
  );
}
