import Link from 'next/link';
import type { ActionItem } from '@/lib/queries/dashboard-queries';

export function AlertBar({ items }: { items: ActionItem[] }) {
  const redItems = items.filter((i) => i.urgency === 'red');
  if (redItems.length === 0) return null;

  return (
    <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 mb-6">
      <p className="text-sm font-medium text-red-300 mb-2">
        {redItems.length} critical item{redItems.length > 1 ? 's' : ''} need attention
      </p>
      <ul className="space-y-1">
        {redItems.slice(0, 5).map((item, i) => (
          <li key={i}>
            <Link href={item.link} className="text-sm text-red-400 hover:text-red-300 underline">
              {item.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
