import Link from 'next/link';
import type { UpcomingDeadline } from '@/lib/queries/dashboard-queries';

const typeStyles: Record<string, { badge: string; color: string }> = {
  deliverable: { badge: 'Deliverable', color: 'bg-blue-900/30 text-blue-400' },
  follow_up: { badge: 'Follow-up', color: 'bg-purple-900/30 text-purple-400' },
  contract: { badge: 'Contract', color: 'bg-yellow-900/30 text-yellow-400' },
};

export function UpcomingDeadlines({ deadlines }: { deadlines: UpcomingDeadline[] }) {
  if (deadlines.length === 0) return null;

  return (
    <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
      <h3 className="text-sm font-medium text-gray-400 mb-3">Upcoming (Next 7 Days)</h3>
      <div className="space-y-2">
        {deadlines.slice(0, 8).map((d, i) => {
          const style = typeStyles[d.type];
          return (
            <Link key={i} href={d.link} className="flex items-center gap-3 p-2 rounded hover:bg-gray-800 transition-colors">
              <span className={`text-xs px-2 py-0.5 rounded ${style.color}`}>{style.badge}</span>
              <span className="text-sm text-white flex-1 truncate">{d.title}</span>
              <span className="text-xs text-gray-500">{d.date}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
