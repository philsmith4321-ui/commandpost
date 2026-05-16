import { getDb } from '@/lib/db';
import { getTimeline } from '@/lib/queries/timeline-queries';
import Link from 'next/link';

const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  invoice_paid: { icon: '💰', color: 'text-green-400' },
  invoice_sent: { icon: '📤', color: 'text-blue-400' },
  lead_stage: { icon: '📊', color: 'text-purple-400' },
  deliverable_completed: { icon: '✅', color: 'text-emerald-400' },
  client_added: { icon: '👤', color: 'text-cyan-400' },
  meeting: { icon: '📅', color: 'text-yellow-400' },
  activity: { icon: '📝', color: 'text-gray-400' },
};

export default async function TimelinePage() {
  const db = getDb();
  const events = getTimeline(db, 100);

  // Group by date
  const grouped: Record<string, typeof events> = {};
  for (const event of events) {
    const date = event.timestamp.split('T')[0] || event.timestamp.split(' ')[0];
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(event);
  }

  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Activity Timeline</h1>

      {dates.length === 0 ? (
        <p className="text-gray-400">No activity yet.</p>
      ) : (
        <div className="space-y-8">
          {dates.map((date) => (
            <div key={date}>
              <h2 className="text-sm font-medium text-gray-500 mb-3 sticky top-0 bg-gray-900 py-1">
                {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </h2>
              <div className="space-y-2 border-l-2 border-gray-800 pl-4 ml-2">
                {grouped[date].map((event) => {
                  const config = TYPE_CONFIG[event.type] || TYPE_CONFIG.activity;
                  return (
                    <div key={event.id} className="flex items-start gap-3 py-2">
                      <span className="text-lg mt-0.5">{config.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {event.link ? (
                            <Link href={event.link} className={`font-medium hover:underline ${config.color}`}>
                              {event.title}
                            </Link>
                          ) : (
                            <span className={`font-medium ${config.color}`}>{event.title}</span>
                          )}
                          <span className="text-xs text-gray-600">
                            {event.timestamp.includes('T')
                              ? event.timestamp.split('T')[1]?.slice(0, 5)
                              : event.timestamp.split(' ')[1]?.slice(0, 5)}
                          </span>
                        </div>
                        {event.description && (
                          <p className="text-sm text-gray-500 truncate">{event.description}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
