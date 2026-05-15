const colors: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400',
  paused: 'bg-yellow-500/20 text-yellow-400',
  completed: 'bg-gray-500/20 text-gray-400',
  'on-hold': 'bg-yellow-500/20 text-yellow-400',
  not_started: 'bg-gray-500/20 text-gray-400',
  in_progress: 'bg-blue-500/20 text-blue-400',
  delivered: 'bg-green-500/20 text-green-400',
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
