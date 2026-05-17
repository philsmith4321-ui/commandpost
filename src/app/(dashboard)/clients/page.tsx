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
  searchParams: Promise<{ status?: string; search?: string; tag?: string; sort?: string }>;
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

  // Filter by tag
  const filteredByTag = params.tag
    ? clientsWithHealth.filter(c => c.tags.some(t => t.id === Number(params.tag)))
    : clientsWithHealth;

  // Sort
  const sorted = [...filteredByTag].sort((a, b) => {
    switch (params.sort) {
      case 'revenue-desc': return (b.monthly_value || 0) - (a.monthly_value || 0);
      case 'revenue-asc': return (a.monthly_value || 0) - (b.monthly_value || 0);
      case 'name-asc': return a.name.localeCompare(b.name);
      case 'name-desc': return b.name.localeCompare(a.name);
      case 'health': {
        const order = { healthy: 0, neutral: 1, 'at-risk': 2 };
        return (order[a.health.status as keyof typeof order] || 1) - (order[b.health.status as keyof typeof order] || 1);
      }
      default: return 0;
    }
  });

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

      {/* Search & Sort */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <form method="GET" action="/clients" className="flex-1 min-w-[200px] max-w-sm">
          {params.status && <input type="hidden" name="status" value={params.status} />}
          {params.tag && <input type="hidden" name="tag" value={params.tag} />}
          {params.sort && <input type="hidden" name="sort" value={params.sort} />}
          <input
            type="text"
            name="search"
            defaultValue={params.search || ''}
            placeholder="Search clients..."
            className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:border-blue-500 outline-none"
          />
        </form>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Sort:</span>
          {[
            { label: 'Default', value: '' },
            { label: 'Revenue ↓', value: 'revenue-desc' },
            { label: 'Revenue ↑', value: 'revenue-asc' },
            { label: 'Name A-Z', value: 'name-asc' },
            { label: 'Health', value: 'health' },
          ].map(s => {
            const isActive = (params.sort || '') === s.value;
            const qp = new URLSearchParams();
            if (params.status) qp.set('status', params.status);
            if (params.search) qp.set('search', params.search);
            if (params.tag) qp.set('tag', params.tag);
            if (s.value) qp.set('sort', s.value);
            return (
              <Link key={s.value} href={`/clients?${qp.toString()}`}
                className={`px-2 py-1 rounded text-xs transition-colors ${isActive ? 'bg-blue-600/20 text-blue-400' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                {s.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {params.tag && (
          <Link href={`/clients${params.status ? `?status=${params.status}` : ''}${params.sort ? `${params.status ? '&' : '?'}sort=${params.sort}` : ''}`}
            className="text-xs px-2 py-1 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50 transition-colors">
            Clear filter ×
          </Link>
        )}
        {tags.map(t => {
          const isTagActive = params.tag === String(t.id);
          const qp = new URLSearchParams();
          if (params.status) qp.set('status', params.status);
          if (params.search) qp.set('search', params.search);
          if (params.sort) qp.set('sort', params.sort);
          if (!isTagActive) qp.set('tag', String(t.id));
          return (
            <Link key={t.id} href={`/clients?${qp.toString()}`}
              className={`text-xs px-2 py-1 rounded transition-colors ${isTagActive ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
              {t.name}
            </Link>
          );
        })}
        <form action={createTagAction} className="inline-flex gap-1">
          <input type="text" name="name" placeholder="New tag..." className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white w-24" />
          <button type="submit" className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-xs text-white rounded">+</button>
        </form>
        <form action={deleteTagAction} className="inline-flex gap-1">
          <select name="tag_id" className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white">
            {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button type="submit" className="px-2 py-1 bg-red-900/50 hover:bg-red-900 text-xs text-red-400 rounded">Delete</button>
        </form>
      </div>

      <p className="text-xs text-gray-600 mb-4">{sorted.length} client{sorted.length !== 1 ? 's' : ''}</p>

      {sorted.length === 0 ? (
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
          {sorted.map((client) => (
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
