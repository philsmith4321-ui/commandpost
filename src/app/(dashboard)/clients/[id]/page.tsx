import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getClientById, getClientHealth } from '@/lib/queries/client-queries';
import { getClientRecurringInvoices, getClientRevenueHistory } from '@/lib/queries/invoice-queries';
import { RevenueChart } from '@/components/revenue-chart';
import { StatusBadge } from '@/components/status-badge';
import { ClientHealthBadge } from '@/components/client-health-badge';
import { ProjectsList } from '@/components/projects-list';
import { ActivityLog } from '@/components/activity-log';
import { DeleteClientButton } from '@/components/delete-client-button';
import { RecurringInvoiceForm } from '@/components/recurring-invoice-form';
import { PortalLinkCard } from '@/components/portal-link-card';
import { togglePinClientAction } from '@/lib/actions/dashboard-actions';
import { getClientTags, listTags } from '@/lib/queries/tag-queries';
import { addTagToClientAction, removeTagFromClientAction } from '@/lib/actions/tag-actions';
import { listClientDocuments } from '@/lib/queries/document-queries';
import { ClientDocuments } from '@/components/client-documents';
import { getClientChecklists, listOnboardingTemplates } from '@/lib/queries/onboarding-queries';
import { ClientOnboarding } from '@/components/client-onboarding';
import { getClientActivity } from '@/lib/queries/client-activity-queries';
import type { Project, ActivityLog as ActivityLogType } from '@/lib/types';

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const client = getClientById(db, Number(id));

  if (!client) {
    notFound();
  }

  const projects = db
    .prepare('SELECT * FROM projects WHERE client_id = ? ORDER BY created_at DESC')
    .all(Number(id)) as Project[];

  const activities = db
    .prepare('SELECT * FROM activity_logs WHERE client_id = ? ORDER BY created_at DESC LIMIT 50')
    .all(Number(id)) as ActivityLogType[];

  const health = getClientHealth(db, Number(id));
  const recurringInvoices = getClientRecurringInvoices(db, Number(id));
  const clientTags = getClientTags(db, Number(id));
  const allTags = listTags(db);
  const availableTags = allTags.filter(t => !clientTags.find(ct => ct.id === t.id));
  const documents = listClientDocuments(db, Number(id));
  const revenueHistory = getClientRevenueHistory(db, Number(id));
  const checklists = getClientChecklists(db, Number(id));
  const onboardingTemplates = listOnboardingTemplates(db);
  const clientActivity = getClientActivity(db, Number(id));

  return (
    <div className="p-4 sm:p-6 bg-gray-950 min-h-screen">
      <Link
        href="/clients"
        className="text-gray-400 hover:text-white text-sm transition-colors"
      >
        &larr; Back to Clients
      </Link>

      <div className="flex items-center gap-4 mt-4 mb-6">
        <h1 className="text-2xl font-bold text-white">{client.name}</h1>
        <StatusBadge status={client.status} />
        <form action={togglePinClientAction} className="ml-auto">
          <input type="hidden" name="client_id" value={client.id} />
          <input type="hidden" name="is_pinned" value={(client as any).is_pinned || 0} />
          <button type="submit" className="px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors" title={(client as any).is_pinned ? 'Unpin from dashboard' : 'Pin to dashboard'}>
            {(client as any).is_pinned ? '★' : '☆'}
          </button>
        </form>
        <Link
          href={`/clients/${client.id}/edit`}
          className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
        >
          Edit
        </Link>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {clientTags.map(tag => (
          <form key={tag.id} action={removeTagFromClientAction} className="inline">
            <input type="hidden" name="client_id" value={client.id} />
            <input type="hidden" name="tag_id" value={tag.id} />
            <button type="submit" className="inline-flex items-center gap-1 px-2 py-1 bg-blue-900/30 text-blue-400 text-xs rounded hover:bg-red-900/30 hover:text-red-400 transition-colors" title="Remove tag">
              {tag.name} ×
            </button>
          </form>
        ))}
        {availableTags.length > 0 && (
          <form action={addTagToClientAction} className="inline-flex gap-1">
            <input type="hidden" name="client_id" value={client.id} />
            <select name="tag_id" className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white">
              {availableTags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button type="submit" className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-xs text-white rounded">+ Tag</button>
          </form>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Email</p>
          <p className="text-white text-sm">{client.email || 'Not set'}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Phone</p>
          <p className="text-white text-sm">{client.phone || 'Not set'}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Monthly Value</p>
          <p className="text-white text-sm">
            {client.monthly_value != null
              ? `$${client.monthly_value.toLocaleString()}`
              : 'Not set'}
          </p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Source</p>
          <p className="text-white text-sm">{client.source || 'Not set'}</p>
        </div>
        {client.notes && (
          <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg md:col-span-2">
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Notes</p>
            <p className="text-white text-sm whitespace-pre-wrap">{client.notes}</p>
          </div>
        )}
      </div>

      {/* Health Score */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-white mb-3">Client Health</h3>
        <ClientHealthBadge health={health} showBreakdown />
      </div>

      {/* Revenue History */}
      {revenueHistory.length > 0 && (
        <div className="mb-8">
          <RevenueChart data={revenueHistory} title="Revenue History" />
        </div>
      )}

      {/* Client Portal */}
      <div className="mb-8">
        <PortalLinkCard clientId={client.id} token={(client as any).portal_token || null} />
      </div>

      {/* Recurring Invoices */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-white mb-3">Recurring Invoices</h3>
        {recurringInvoices.length > 0 && (
          <div className="space-y-2 mb-4">
            {recurringInvoices.map((inv) => (
              <Link key={inv.id} href={`/finances/invoices/${inv.id}`}
                className="flex items-center justify-between p-3 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors">
                <div>
                  <span className="text-white text-sm font-medium">{inv.invoice_number}</span>
                  <span className="text-gray-500 text-xs ml-2">Day {inv.recurrence_day} of each month</span>
                </div>
                <span className="text-white text-sm">${inv.total_amount.toLocaleString()}/mo</span>
              </Link>
            ))}
          </div>
        )}
        {recurringInvoices.length === 0 && (
          <p className="text-sm text-gray-500 mb-4">No recurring invoices for this client.</p>
        )}
        <RecurringInvoiceForm clientId={client.id} />
      </div>

      <div className="mb-8">
        <ProjectsList clientId={client.id} projects={projects} />
      </div>

      <div className="mb-8">
        <ClientOnboarding clientId={client.id} checklists={checklists} templates={onboardingTemplates} />
      </div>

      <div className="mb-8">
        <ClientDocuments clientId={client.id} documents={documents} />
      </div>

      {/* Unified Activity Feed */}
      {clientActivity.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-white mb-3">Activity Feed</h3>
          <div className="space-y-2">
            {clientActivity.slice(0, 20).map(evt => {
              const icon = evt.type === 'invoice_paid' ? '$$' : evt.type === 'invoice_sent' ? '→' : evt.type === 'invoice_created' ? '+' : evt.type === 'proposal' ? '▤' : evt.type === 'meeting' ? '◉' : evt.type === 'time' ? '◷' : '●';
              return (
                <div key={evt.id} className="flex items-start gap-3 p-3 bg-gray-900 border border-gray-800 rounded-lg">
                  <span className="text-sm mt-0.5 text-gray-500 w-5 text-center">{icon}</span>
                  <div className="flex-1 min-w-0">
                    {evt.link ? (
                      <a href={evt.link} className="text-sm text-white hover:text-blue-400">{evt.title}</a>
                    ) : (
                      <p className="text-sm text-white">{evt.title}</p>
                    )}
                    {evt.description && <p className="text-xs text-gray-500 truncate">{evt.description}</p>}
                  </div>
                  <span className="text-xs text-gray-600 whitespace-nowrap">{evt.timestamp.slice(0, 10)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-8">
        <ActivityLog clientId={client.id} activities={activities} />
      </div>

      <DeleteClientButton clientId={client.id} />
    </div>
  );
}
