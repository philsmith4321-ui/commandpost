import Link from 'next/link';
import { getDb } from '@/lib/db';
import { getDashboardSummary, getActionItems, getRecentActivity } from '@/lib/queries/dashboard-queries';
import { AlertBar } from '@/components/alert-bar';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  const db = getDb();
  const summary = getDashboardSummary(db);
  const actionItems = getActionItems(db);
  const recentActivity = getRecentActivity(db);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="p-4 sm:p-6">
      <h2 className="text-2xl font-bold mb-1">{greeting}</h2>
      <p className="text-gray-400 mb-6">
        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
      </p>

      <AlertBar items={actionItems} />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-8">
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
          <p className="text-xs text-gray-500 uppercase mb-1">Servers</p>
          <p className={`text-2xl font-bold ${summary.serversDown > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {summary.serversDown > 0 ? `${summary.serversDown} down` : 'All OK'}
          </p>
        </div>
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
                  {item.type === 'overdue_invoice' ? 'OVERDUE' : item.type === 'missed_follow_up' ? 'FOLLOW UP' : item.type === 'server_down' ? 'DOWN' : item.urgency === 'red' ? 'OVERDUE' : 'DUE SOON'}
                </span>
                <span className="text-sm text-white">{item.title}</span>
              </Link>
            ))}
          </div>
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
