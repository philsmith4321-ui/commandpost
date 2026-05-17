import Link from 'next/link';
import { getDb } from '@/lib/db';
import { listMeetings } from '@/lib/queries/meeting-queries';

export const dynamic = 'force-dynamic';

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; client?: string }>;
}) {
  const params = await searchParams;
  const db = getDb();
  const allMeetings = listMeetings(db, 200);

  // Filter
  let meetings = allMeetings;
  if (params.search) {
    const q = params.search.toLowerCase();
    meetings = meetings.filter(m =>
      m.title.toLowerCase().includes(q) ||
      m.client_name.toLowerCase().includes(q) ||
      (m.notes && m.notes.toLowerCase().includes(q)) ||
      (m.action_items && m.action_items.toLowerCase().includes(q))
    );
  }
  if (params.client) {
    meetings = meetings.filter(m => m.client_id === Number(params.client));
  }

  // Stats
  const thisMonth = new Date().toISOString().slice(0, 7);
  const meetingsThisMonth = allMeetings.filter(m => m.meeting_date.startsWith(thisMonth)).length;
  const totalMinutes = allMeetings.reduce((sum, m) => sum + (m.duration_minutes || 0), 0);

  // Unique clients for filter
  const clientSet = new Map<number, string>();
  allMeetings.forEach(m => clientSet.set(m.client_id, m.client_name));
  const clients = Array.from(clientSet.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Meetings</h1>
        <Link href="/meetings/new" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors">
          Log Meeting
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Total Meetings</p>
          <p className="text-2xl font-bold text-white">{allMeetings.length}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">This Month</p>
          <p className="text-2xl font-bold text-white">{meetingsThisMonth}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Total Hours</p>
          <p className="text-2xl font-bold text-white">{(totalMinutes / 60).toFixed(1)}h</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <form method="GET" action="/meetings" className="flex-1 min-w-[200px] max-w-sm">
          {params.client && <input type="hidden" name="client" value={params.client} />}
          <input
            type="text"
            name="search"
            defaultValue={params.search || ''}
            placeholder="Search meetings..."
            className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:border-blue-500 outline-none"
          />
        </form>
        <div className="flex items-center gap-2">
          <Link href="/meetings" className={`px-2 py-1 rounded text-xs ${!params.client ? 'bg-blue-600/20 text-blue-400' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>All</Link>
          {clients.slice(0, 8).map(c => (
            <Link key={c.id} href={`/meetings?client=${c.id}${params.search ? `&search=${params.search}` : ''}`}
              className={`px-2 py-1 rounded text-xs transition-colors ${String(c.id) === params.client ? 'bg-blue-600/20 text-blue-400' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              {c.name}
            </Link>
          ))}
        </div>
      </div>

      {meetings.length === 0 ? (
        <p className="text-gray-500 text-sm">No meetings found.</p>
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
                <p className="text-sm text-gray-400 mt-2 whitespace-pre-wrap line-clamp-3">{m.notes}</p>
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
