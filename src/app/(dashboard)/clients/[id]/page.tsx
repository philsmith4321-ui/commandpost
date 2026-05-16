import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getClientById, getClientHealth } from '@/lib/queries/client-queries';
import { getClientRecurringInvoices } from '@/lib/queries/invoice-queries';
import { StatusBadge } from '@/components/status-badge';
import { ClientHealthBadge } from '@/components/client-health-badge';
import { ProjectsList } from '@/components/projects-list';
import { ActivityLog } from '@/components/activity-log';
import { DeleteClientButton } from '@/components/delete-client-button';
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
        <Link
          href={`/clients/${client.id}/edit`}
          className="ml-auto px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
        >
          Edit
        </Link>
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

      {/* Recurring Invoices */}
      {recurringInvoices.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-white mb-3">Recurring Invoices</h3>
          <div className="space-y-2">
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
        </div>
      )}

      <div className="mb-8">
        <ProjectsList clientId={client.id} projects={projects} />
      </div>

      <div className="mb-8">
        <ActivityLog clientId={client.id} activities={activities} />
      </div>

      <DeleteClientButton clientId={client.id} />
    </div>
  );
}
