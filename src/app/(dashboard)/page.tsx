import Link from 'next/link';
import { getDb } from '@/lib/db';
import { getDashboardSummary, getActionItems, getRecentActivity, getRevenueTrend, getUpcomingDeadlines, getPinnedClients } from '@/lib/queries/dashboard-queries';
import { AlertBar } from '@/components/alert-bar';
import { isClaudeConfigured } from '@/lib/claude';
import { DashboardQuery } from '@/components/dashboard-query';
import { RevenueChart } from '@/components/revenue-chart';
import { QuickActions } from '@/components/quick-actions';
import { UpcomingDeadlines } from '@/components/upcoming-deadlines';
import { QuickNoteForm } from '@/components/quick-note-form';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  const db = getDb();
  const summary = getDashboardSummary(db);
  const actionItems = getActionItems(db);
  const recentActivity = getRecentActivity(db);
  const revenueTrend = getRevenueTrend(db);
  const upcomingDeadlines = getUpcomingDeadlines(db);
  const pinnedClients = getPinnedClients(db);
  const activeClients = db.prepare("SELECT id, name FROM clients WHERE status = 'active' AND deleted_at IS NULL ORDER BY name").all() as { id: number; name: string }[];
  const claudeEnabled = isClaudeConfigured();

  // Proposals summary
  const proposalStats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN p.status = 'draft' THEN 1 ELSE 0 END) as drafts,
      SUM(CASE WHEN p.status = 'sent' THEN 1 ELSE 0 END) as sent,
      SUM(CASE WHEN p.status = 'accepted' THEN 1 ELSE 0 END) as accepted,
      COALESCE(SUM(CASE WHEN p.status = 'sent' THEN (SELECT COALESCE(SUM(li.amount), 0) FROM proposal_items li WHERE li.proposal_id = p.id) ELSE 0 END), 0) as pending_value
    FROM proposals p
  `).get() as { total: number; drafts: number; sent: number; accepted: number; pending_value: number };

  // Pipeline conversion rate
  const totalLeads = (db.prepare("SELECT COUNT(*) as cnt FROM leads").get() as any).cnt;
  const wonLeads = (db.prepare("SELECT COUNT(*) as cnt FROM leads WHERE stage = 'won'").get() as any).cnt;
  const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;

  // Expiring contracts
  const expiringContracts = db.prepare(`
    SELECT ct.title, c.name as client_name, ct.expires_at
    FROM contracts ct JOIN clients c ON ct.client_id = c.id
    WHERE ct.status = 'active' AND ct.expires_at IS NOT NULL
      AND ct.expires_at <= date('now', '+30 days') AND ct.expires_at >= date('now')
    ORDER BY ct.expires_at ASC LIMIT 5
  `).all() as { title: string; client_name: string; expires_at: string }[];

  // Today's stats
  const today = new Date().toISOString().split('T')[0];
  const todayMinutes = (db.prepare(
    "SELECT COALESCE(SUM(duration_minutes), 0) as total FROM time_entries WHERE entry_date = ?"
  ).get(today) as any).total;
  const todayHours = todayMinutes / 60;

  // This week's revenue
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekRevenue = (db.prepare(
    "SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'paid' AND paid_at >= ?"
  ).get(weekStart.toISOString().split('T')[0]) as any).total;

  // Upcoming follow-ups
  const followUps = db.prepare(
    "SELECT id, business_name, follow_up_date FROM leads WHERE follow_up_date IS NOT NULL AND follow_up_date >= ? AND stage NOT IN ('won','lost') ORDER BY follow_up_date LIMIT 5"
  ).all(today) as { id: number; business_name: string; follow_up_date: string }[];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="p-4 sm:p-6">
      <h2 className="text-2xl font-bold mb-1">{greeting}</h2>
      <p className="text-gray-400 mb-6">
        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
      </p>

      <QuickActions />

      {claudeEnabled && <DashboardQuery />}

      <AlertBar items={actionItems} />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 mb-8">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Active Clients</p>
          <p className="text-2xl font-bold text-white">{summary.activeClients}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Monthly Revenue</p>
          <p className="text-2xl font-bold text-white">${summary.monthlyRevenue.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Outstanding</p>
          <p className={`text-2xl font-bold ${summary.overdueInvoiceAmount > 0 ? 'text-red-400' : 'text-white'}`}>
            ${summary.outstandingInvoices.toLocaleString()}
          </p>
          {summary.overdueInvoiceAmount > 0 && (
            <p className="text-xs text-red-400">${summary.overdueInvoiceAmount.toLocaleString()} overdue</p>
          )}
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Pipeline</p>
          <p className="text-2xl font-bold text-white">{summary.pipelineLeads}</p>
          <p className="text-xs text-gray-500">${summary.pipelineValue.toLocaleString()} value</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">MRR</p>
          <p className="text-2xl font-bold text-white">${summary.mrr.toLocaleString()}</p>
        </div>
        {summary.uninvoicedTime > 0 && (
          <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
            <p className="text-xs text-gray-500 uppercase mb-1">Uninvoiced Time</p>
            <p className="text-2xl font-bold text-yellow-400">${summary.uninvoicedTime.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
          </div>
        )}
        {totalLeads > 0 && (
          <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
            <p className="text-xs text-gray-500 uppercase mb-1">Win Rate</p>
            <p className="text-2xl font-bold text-white">{conversionRate}%</p>
            <p className="text-xs text-gray-500">{wonLeads}/{totalLeads} leads</p>
          </div>
        )}
      </div>

      {/* Proposals & Today */}
      {(proposalStats.drafts > 0 || proposalStats.sent > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
            <p className="text-xs text-gray-500 uppercase mb-1">Draft Proposals</p>
            <p className="text-2xl font-bold text-gray-300">{proposalStats.drafts}</p>
          </div>
          <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
            <p className="text-xs text-gray-500 uppercase mb-1">Awaiting Response</p>
            <p className="text-2xl font-bold text-yellow-400">{proposalStats.sent}</p>
            {proposalStats.pending_value > 0 && (
              <p className="text-xs text-gray-500">${proposalStats.pending_value.toLocaleString()} value</p>
            )}
          </div>
          <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
            <p className="text-xs text-gray-500 uppercase mb-1">Accepted</p>
            <p className="text-2xl font-bold text-green-400">{proposalStats.accepted}</p>
          </div>
          <Link href="/proposals" className="p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-blue-600 transition-colors">
            <p className="text-xs text-gray-500 uppercase mb-1">View All</p>
            <p className="text-sm text-blue-400">{proposalStats.total} total proposals →</p>
          </Link>
        </div>
      )}

      {/* Today & This Week */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Today&apos;s Hours</p>
          <p className="text-2xl font-bold text-white">{todayHours.toFixed(1)}h</p>
          <Link href="/finances/time" className="text-xs text-blue-400 hover:text-blue-300">View time log →</Link>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">This Week&apos;s Revenue</p>
          <p className="text-2xl font-bold text-green-400">${weekRevenue.toLocaleString()}</p>
        </div>
        {followUps.length > 0 && (
          <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
            <p className="text-xs text-gray-500 uppercase mb-2">Upcoming Follow-ups</p>
            <div className="space-y-1">
              {followUps.map(f => (
                <Link key={f.id} href={`/pipeline`} className="flex justify-between text-xs hover:text-blue-400">
                  <span className="text-white truncate">{f.business_name}</span>
                  <span className="text-gray-500 ml-2">{f.follow_up_date.slice(5)}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Revenue & Deadlines */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <RevenueChart data={revenueTrend} />
        <UpcomingDeadlines deadlines={upcomingDeadlines} />
      </div>

      {/* Action Items */}
      {actionItems.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-3">Action Items</h3>
          <div className="space-y-2">
            {actionItems.map((item, i) => (
              <Link key={i} href={item.link}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  item.urgency === 'red' ? 'border-red-900 bg-red-900/10 hover:bg-red-900/20' : 'border-yellow-900 bg-yellow-900/10 hover:bg-yellow-900/20'
                }`}>
                <span className={`text-xs font-medium uppercase ${item.urgency === 'red' ? 'text-red-400' : 'text-yellow-400'}`}>
                  {item.type === 'overdue_invoice' ? 'OVERDUE' : item.type === 'missed_follow_up' ? 'FOLLOW UP' : item.type === 'client_needs_attention' ? 'CLIENT' : item.type === 'client_at_risk' ? 'CLIENT' : item.urgency === 'red' ? 'OVERDUE' : 'DUE SOON'}
                </span>
                <span className="text-sm text-white">{item.title}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Expiring Contracts */}
      {expiringContracts.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-3">Contracts Expiring Soon</h3>
          <div className="space-y-2">
            {expiringContracts.map((c, i) => (
              <Link key={i} href="/contracts"
                className="flex items-center justify-between p-3 bg-yellow-900/10 border border-yellow-800/50 rounded-lg hover:bg-yellow-900/20 transition-colors">
                <div>
                  <span className="text-sm text-white">{c.title}</span>
                  <span className="text-xs text-gray-500 ml-2">{c.client_name}</span>
                </div>
                <span className="text-xs text-yellow-400">{c.expires_at}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Pinned Clients */}
      {pinnedClients.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-3">Pinned Clients</h3>
          <div className="flex flex-wrap gap-2">
            {pinnedClients.map(c => (
              <Link key={c.id} href={`/clients/${c.id}`} className="px-3 py-2 bg-gray-900 border border-gray-800 hover:border-blue-600 rounded-lg text-sm text-white transition-colors">
                {c.name}
                {c.monthly_value ? <span className="ml-2 text-xs text-gray-500">${c.monthly_value.toLocaleString()}/mo</span> : null}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick Note */}
      {activeClients.length > 0 && (
        <div className="mb-8">
          <QuickNoteForm clients={activeClients} />
        </div>
      )}

      {/* Recent Activity */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Recent Activity</h3>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-gray-500">No activity yet. Start by adding clients and notes.</p>
        ) : (
          <div className="space-y-2">
            {recentActivity.map((activity, i) => (
              <div key={i} className="flex gap-3 p-3 bg-gray-900 border border-gray-800 rounded-lg">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-600 mt-2 shrink-0" />
                <div>
                  <p className="text-sm text-white">{activity.content}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {activity.client_name} &middot;{' '}
                    {new Date(activity.created_at + 'Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
