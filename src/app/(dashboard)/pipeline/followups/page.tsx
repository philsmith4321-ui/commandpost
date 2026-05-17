import Link from 'next/link';
import { getDb } from '@/lib/db';
import { getOverdueFollowUps, getUpcomingFollowUps } from '@/lib/queries/followup-queries';
import { snoozeFollowUpAction } from '@/lib/actions/followup-actions';

export const dynamic = 'force-dynamic';

export default function FollowUpsPage() {
  const db = getDb();
  const overdue = getOverdueFollowUps(db);
  const upcoming = getUpcomingFollowUps(db, 14);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Follow-up Reminders</h2>
        <Link href="/pipeline" className="text-sm text-gray-400 hover:text-white">&larr; Pipeline</Link>
      </div>

      {/* Overdue */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-red-400 mb-3">
          Overdue ({overdue.length})
        </h3>
        {overdue.length === 0 ? (
          <p className="text-sm text-gray-500">No overdue follow-ups. Nice!</p>
        ) : (
          <div className="space-y-2">
            {overdue.map(lead => (
              <div key={lead.id} className="p-4 bg-red-900/10 border border-red-900/50 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <Link href={`/pipeline`} className="text-white font-medium hover:text-blue-400">
                      {lead.business_name}
                    </Link>
                    <div className="flex gap-4 mt-1 text-xs text-gray-400">
                      <span>{lead.stage}</span>
                      {lead.contact_person && <span>{lead.contact_person}</span>}
                      {lead.estimated_value && <span>${lead.estimated_value.toLocaleString()}</span>}
                    </div>
                    <p className="text-xs text-red-400 mt-1">
                      {lead.days_overdue} day{lead.days_overdue !== 1 ? 's' : ''} overdue (due {lead.follow_up_date})
                    </p>
                    {lead.last_note && (
                      <p className="text-xs text-gray-500 mt-1 truncate max-w-md">Last note: {lead.last_note}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <form action={snoozeFollowUpAction}>
                      <input type="hidden" name="lead_id" value={lead.id} />
                      <input type="hidden" name="days" value="1" />
                      <button type="submit" className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded">+1d</button>
                    </form>
                    <form action={snoozeFollowUpAction}>
                      <input type="hidden" name="lead_id" value={lead.id} />
                      <input type="hidden" name="days" value="3" />
                      <button type="submit" className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded">+3d</button>
                    </form>
                    <form action={snoozeFollowUpAction}>
                      <input type="hidden" name="lead_id" value={lead.id} />
                      <input type="hidden" name="days" value="7" />
                      <button type="submit" className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded">+1w</button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming */}
      <div>
        <h3 className="text-lg font-semibold text-yellow-400 mb-3">
          Upcoming ({upcoming.length})
        </h3>
        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-500">No upcoming follow-ups in the next 14 days.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map(lead => (
              <div key={lead.id} className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <Link href={`/pipeline`} className="text-white font-medium hover:text-blue-400">
                      {lead.business_name}
                    </Link>
                    <div className="flex gap-4 mt-1 text-xs text-gray-400">
                      <span>{lead.stage}</span>
                      {lead.contact_person && <span>{lead.contact_person}</span>}
                      {lead.estimated_value && <span>${lead.estimated_value.toLocaleString()}</span>}
                    </div>
                    <p className="text-xs text-yellow-400 mt-1">Follow up on {lead.follow_up_date}</p>
                    {lead.last_note && (
                      <p className="text-xs text-gray-500 mt-1 truncate max-w-md">Last note: {lead.last_note}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <form action={snoozeFollowUpAction}>
                      <input type="hidden" name="lead_id" value={lead.id} />
                      <input type="hidden" name="days" value="3" />
                      <button type="submit" className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded">+3d</button>
                    </form>
                    <form action={snoozeFollowUpAction}>
                      <input type="hidden" name="lead_id" value={lead.id} />
                      <input type="hidden" name="days" value="7" />
                      <button type="submit" className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded">+1w</button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
