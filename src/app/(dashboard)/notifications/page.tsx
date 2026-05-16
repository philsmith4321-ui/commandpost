import Link from 'next/link';
import { getDb } from '@/lib/db';
import { getNotificationsFiltered } from '@/lib/queries/notification-queries';
import { markNotificationReadAction, markAllNotificationsReadAction } from '@/lib/actions/notification-actions';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; start?: string; end?: string }>;
}) {
  const sp = await searchParams;
  const db = getDb();

  const filters: { type?: string; isRead?: boolean; startDate?: string; endDate?: string } = {};
  if (sp.type) filters.type = sp.type;
  if (sp.status === 'read') filters.isRead = true;
  if (sp.status === 'unread') filters.isRead = false;
  if (sp.start) filters.startDate = sp.start;
  if (sp.end) filters.endDate = sp.end;

  const notifications = getNotificationsFiltered(db, filters);

  const typeLabels: Record<string, string> = {
    server_down: 'Server Down',
    server_recovered: 'Server Recovered',
    client_health_critical: 'Client Health',
    invoice_overdue: 'Invoice Overdue',
    invoice_paid: 'Invoice Paid',
    deliverable_overdue: 'Deliverable Overdue',
    follow_up_due: 'Follow-up Due',
    lead_stage_changed: 'Lead Stage',
    time_invoiced: 'Time Invoiced',
  };

  const typeColors: Record<string, string> = {
    server_down: 'bg-red-900/30 text-red-400',
    server_recovered: 'bg-green-900/30 text-green-400',
    client_health_critical: 'bg-red-900/30 text-red-400',
    invoice_overdue: 'bg-yellow-900/30 text-yellow-400',
    invoice_paid: 'bg-green-900/30 text-green-400',
    deliverable_overdue: 'bg-yellow-900/30 text-yellow-400',
    follow_up_due: 'bg-blue-900/30 text-blue-400',
    lead_stage_changed: 'bg-purple-900/30 text-purple-400',
    time_invoiced: 'bg-green-900/30 text-green-400',
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <div className="flex gap-2">
          <form action={markAllNotificationsReadAction}>
            <button type="submit" className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors">
              Mark all read
            </button>
          </form>
          <Link href="/settings/notifications" className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors">
            Settings
          </Link>
        </div>
      </div>

      {/* Filters */}
      <form className="flex flex-wrap gap-3 mb-6">
        <select name="type" defaultValue={sp.type || ''} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
          <option value="">All Types</option>
          {Object.entries(typeLabels).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select name="status" defaultValue={sp.status || ''} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
          <option value="">All</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </select>
        <input type="date" name="start" defaultValue={sp.start || ''} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
        <input type="date" name="end" defaultValue={sp.end || ''} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
        <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors">
          Filter
        </button>
      </form>

      {/* Notification List */}
      {notifications.length === 0 ? (
        <p className="text-gray-500 text-sm">No notifications found.</p>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div key={n.id} className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${n.is_read ? 'bg-gray-900/50 border-gray-800/50' : 'bg-gray-900 border-gray-800'}`}>
              {!n.is_read && <span className="w-2 h-2 mt-2 rounded-full bg-blue-400 shrink-0" />}
              {!!n.is_read && <span className="w-2 h-2 mt-2 rounded-full bg-transparent shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded ${typeColors[n.type] || 'bg-gray-800 text-gray-400'}`}>
                    {typeLabels[n.type] || n.type}
                  </span>
                  <span className="text-xs text-gray-500">{new Date(n.created_at + 'Z').toLocaleString()}</span>
                </div>
                {n.link ? (
                  <Link href={n.link} className="text-sm text-white hover:text-blue-400">
                    {n.title}
                  </Link>
                ) : (
                  <p className="text-sm text-white">{n.title}</p>
                )}
                {n.message && <p className="text-sm text-gray-400 mt-1">{n.message}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
