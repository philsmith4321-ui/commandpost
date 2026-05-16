import { getDb } from '@/lib/db';
import { getTimeStats, getTimeEntriesFiltered } from '@/lib/queries/time-queries';
import { FinanceTabs } from '@/components/finance-tabs';
import { BulkTimeTable } from '@/components/bulk-time-table';

export const dynamic = 'force-dynamic';

export default async function FinancesTimePage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; project?: string; start?: string; end?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const db = getDb();
  const stats = getTimeStats(db);

  const filters: { clientId?: number; projectId?: number; startDate?: string; endDate?: string; invoiced?: boolean } = {};
  if (sp.client) filters.clientId = Number(sp.client);
  if (sp.project) filters.projectId = Number(sp.project);
  if (sp.start) filters.startDate = sp.start;
  if (sp.end) filters.endDate = sp.end;
  if (sp.status === 'invoiced') filters.invoiced = true;
  if (sp.status === 'uninvoiced') filters.invoiced = false;

  const entries = getTimeEntriesFiltered(db, filters);

  const clients = db.prepare("SELECT id, name FROM clients WHERE deleted_at IS NULL ORDER BY name").all() as { id: number; name: string }[];
  const projects = db.prepare("SELECT id, name FROM projects ORDER BY name").all() as { id: number; name: string }[];

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-bold mb-4">Finances</h1>
      <FinanceTabs active="time" />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Hours This Month</p>
          <p className="text-2xl font-bold text-white">{stats.hoursThisMonth.toFixed(1)}h</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Uninvoiced Total</p>
          <p className="text-2xl font-bold text-yellow-400">${stats.uninvoicedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Uninvoiced Hours</p>
          <p className="text-2xl font-bold text-yellow-400">{stats.uninvoicedHours.toFixed(1)}h</p>
        </div>
      </div>

      {/* Filters */}
      <form className="flex flex-wrap gap-3 mb-6">
        <select name="client" defaultValue={sp.client || ''} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
          <option value="">All Clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="project" defaultValue={sp.project || ''} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input type="date" name="start" defaultValue={sp.start || ''} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
        <input type="date" name="end" defaultValue={sp.end || ''} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
        <select name="status" defaultValue={sp.status || ''} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
          <option value="">All Status</option>
          <option value="uninvoiced">Uninvoiced</option>
          <option value="invoiced">Invoiced</option>
        </select>
        <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors">
          Filter
        </button>
      </form>

      <BulkTimeTable entries={entries} clientId={sp.client} />
    </div>
  );
}
