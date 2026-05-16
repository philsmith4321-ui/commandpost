import Link from 'next/link';
import { getDb } from '@/lib/db';
import { listClients, getClientHealth } from '@/lib/queries/client-queries';
import { listTags, getClientTags } from '@/lib/queries/tag-queries';
import { createTagAction, deleteTagAction } from '@/lib/actions/tag-actions';
import { StatusBadge } from '@/components/status-badge';
import { HealthDot } from '@/components/client-health-badge';
import type { ClientStatus } from '@/lib/types';
import { ExportButton } from '@/components/export-button';

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  const params = await searchParams;
  const db = getDb();
  const filter: { status?: ClientStatus; search?: string } = {};

  if (params.status && ['active', 'paused', 'completed'].includes(params.status)) {
    filter.status = params.status as ClientStatus;
  }
  if (params.search) {
    filter.search = params.search;
  }

  const clients = listClients(db, filter);
  const tags = listTags(db);

  const clientsWithHealth = clients.map(client => ({
    ...client,
    health: getClientHealth(db, client.id),
    tags: getClientTags(db, client.id),
  }));

  const tabs = [
    { label: 'All', value: undefined },
    { label: 'Active', value: 'active' },
    { label: 'Paused', value: 'paused' },
    { label: 'Completed', value: 'completed' },
  ];

  return (
    <div className="p-4 sm:p-6 bg-gray-950 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Clients</h1>
        <div className="flex items-center gap-2">
          <ExportButton href="/api/reports/client-health" label="Health Report" format="pdf" small />
          <ExportButton href={`/api/reports/client-revenue?format=csv&start=${new Date().getFullYear()}-01-01&end=${new Date().toISOString().split('T')[0]}`} label="Revenue CSV" format="csv" small />
          <Link
            href="/clients/new"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            + New Client
          </Link>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => {
          const isActive = params.status === tab.value || (!params.status && !tab.value);
          const href = tab.value ? `/clients?status=${tab.value}` : '/clients';
          return (
            <Link
              key={tab.label}
              href={href}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Tags */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {tags.map(t => (
          <form key={t.id} action={deleteTagAction} className="inline">
            <input type="hidden" name="tag_id" value={t.id} />
            <button type="submit" className="text-xs px-2 py-1 bg-gray-800 text-gray-300 rounded hover:bg-red-900/30 hover:text-red-400 transition-colors" title="Delete tag">
              {t.name} ×
            </button>
          </form>
        ))}
        <form action={createTagAction} className="inline-flex gap-1">
          <input type="text" name="name" placeholder="New tag..." className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white w-24" />
          <button type="submit" className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-xs text-white rounded">+</button>
        </form>
      </div>

      {clients.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No clients found.</p>
          <Link
            href="/clients/new"
            className="inline-block mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Add your first client
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {clientsWithHealth.map((client) => (
            <Link
              key={client.id}
              href={`/clients/${client.id}`}
              className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <HealthDot status={client.health.status} />
                <span className="text-white font-medium">{client.name}</span>
                {client.contact_person && (
                  <span className="text-gray-500 text-sm ml-1">
                    {client.contact_person}
                  </span>
                )}
                {client.tags.map(t => (
                  <span key={t.id} className="text-xs px-1.5 py-0.5 bg-blue-900/30 text-blue-400 rounded">{t.name}</span>
                ))}
              </div>
              <div className="flex items-center gap-4">
                {client.monthly_value != null && (
                  <span className="text-gray-400 text-sm">
                    ${client.monthly_value.toLocaleString()}/mo
                  </span>
                )}
                <StatusBadge status={client.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
