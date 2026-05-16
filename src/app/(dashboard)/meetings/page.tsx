import Link from 'next/link';
import { getDb } from '@/lib/db';
import { listMeetings } from '@/lib/queries/meeting-queries';

export const dynamic = 'force-dynamic';

export default function MeetingsPage() {
  const db = getDb();
  const meetings = listMeetings(db);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Meetings</h1>
        <Link href="/meetings/new" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors">
          Log Meeting
        </Link>
      </div>

      {meetings.length === 0 ? (
        <p className="text-gray-500 text-sm">No meetings logged yet.</p>
      ) : (
        <div className="space-y-3">
          {meetings.map(m => (
            <div key={m.id} className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-white font-medium">{m.title}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {m.client_name}{m.project_name ? ` / ${m.project_name}` : ''} &middot; {m.meeting_date}
                    {m.duration_minutes ? ` &middot; ${m.duration_minutes}min` : ''}
                  </p>
                </div>
                <Link href={`/clients/${m.client_id}`} className="text-xs text-blue-400 hover:text-blue-300">
                  View Client
                </Link>
              </div>
              {m.notes && (
                <p className="text-sm text-gray-400 mt-2 whitespace-pre-wrap">{m.notes}</p>
              )}
              {m.action_items && (
                <div className="mt-2 pt-2 border-t border-gray-800">
                  <p className="text-xs text-gray-500 uppercase mb-1">Action Items</p>
                  <p className="text-sm text-gray-300 whitespace-pre-wrap">{m.action_items}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
