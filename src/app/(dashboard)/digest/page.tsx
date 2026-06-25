import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default function DigestPage() {
  const db = getDb();
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const weekEndStr = now.toISOString().split('T')[0];

  // Paid invoices this week
  const paidThisWeek = db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count
    FROM invoices WHERE status = 'paid' AND paid_at >= ?
  `).get(weekStartStr) as { total: number; count: number };

  // New clients this week
  const newClients = db.prepare(`
    SELECT COUNT(*) as count FROM clients WHERE created_at >= ? AND deleted_at IS NULL
  `).get(weekStartStr) as { count: number };

  // Deliverables completed this week
  const completed = db.prepare(`
    SELECT COUNT(*) as count FROM deliverables WHERE status = 'delivered' AND completed_at >= ?
  `).get(weekStartStr) as { count: number };

  // Hours logged this week
  const hoursLogged = db.prepare(`
    SELECT COALESCE(SUM(duration_minutes), 0) as total FROM time_entries WHERE entry_date >= ?
  `).get(weekStartStr) as { total: number };

  // Leads won this week
  const leadsWon = db.prepare(`
    SELECT COUNT(*) as count FROM leads WHERE stage = 'won' AND updated_at >= ?
  `).get(weekStartStr) as { count: number };

  // Meetings this week
  const meetings = db.prepare(`
    SELECT COUNT(*) as count FROM meetings WHERE meeting_date >= ? AND meeting_date <= ?
  `).get(weekStartStr, weekEndStr) as { count: number };

  // Upcoming next week
  const nextWeekEnd = new Date(now);
  nextWeekEnd.setDate(now.getDate() + 7);
  const nextWeekStr = nextWeekEnd.toISOString().split('T')[0];

  const upcomingDeliverables = db.prepare(`
    SELECT d.title, d.due_date, c.name as client_name FROM deliverables d
    JOIN projects p ON d.project_id = p.id JOIN clients c ON p.client_id = c.id
    WHERE d.status != 'delivered' AND d.due_date >= ? AND d.due_date <= ? AND c.deleted_at IS NULL
    ORDER BY d.due_date LIMIT 10
  `).all(weekEndStr, nextWeekStr) as { title: string; due_date: string; client_name: string }[];

  const upcomingFollowUps = db.prepare(`
    SELECT business_name, follow_up_date FROM leads
    WHERE stage NOT IN ('won','lost') AND follow_up_date >= ? AND follow_up_date <= ?
    ORDER BY follow_up_date LIMIT 10
  `).all(weekEndStr, nextWeekStr) as { business_name: string; follow_up_date: string }[];

  return (
    <div className="p-4 sm:p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Weekly Digest</h1>
      <p className="text-gray-400 text-sm mb-6">
        Week of {weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} — {now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
      </p>

      {/* This Week's Numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase">Revenue Collected</p>
          <p className="text-xl font-bold text-green-400">${paidThisWeek.total.toLocaleString()}</p>
          <p className="text-xs text-gray-500">{paidThisWeek.count} invoice{paidThisWeek.count !== 1 ? 's' : ''}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase">Hours Logged</p>
          <p className="text-xl font-bold text-white">{(hoursLogged.total / 60).toFixed(1)}h</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase">Deliverables Done</p>
          <p className="text-xl font-bold text-white">{completed.count}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase">New Clients</p>
          <p className="text-xl font-bold text-white">{newClients.count}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase">Deals Won</p>
          <p className="text-xl font-bold text-white">{leadsWon.count}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase">Meetings</p>
          <p className="text-xl font-bold text-white">{meetings.count}</p>
        </div>
      </div>

      {/* Coming Up */}
      <h2 className="text-lg font-semibold mb-3">Coming Up Next Week</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {upcomingDeliverables.length > 0 && (
          <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Deliverables Due</h3>
            <ul className="space-y-1">
              {upcomingDeliverables.map((d, i) => (
                <li key={i} className="text-sm text-white">
                  {d.title} <span className="text-xs text-gray-500">({d.client_name}, {d.due_date})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {upcomingFollowUps.length > 0 && (
          <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Follow-ups</h3>
            <ul className="space-y-1">
              {upcomingFollowUps.map((f, i) => (
                <li key={i} className="text-sm text-white">
                  {f.business_name} <span className="text-xs text-gray-500">({f.follow_up_date})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {upcomingDeliverables.length === 0 && upcomingFollowUps.length === 0 && (
          <p className="text-gray-500 text-sm">Nothing scheduled for next week.</p>
        )}
      </div>
    </div>
  );
}
