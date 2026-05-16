export type DotColor = 'green' | 'red' | 'yellow';

export function StatusDot({ color }: { color: DotColor }) {
  const colorClass = color === 'green' ? 'bg-green-500' : color === 'red' ? 'bg-red-500' : 'bg-yellow-500';
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${colorClass}`} />;
}
