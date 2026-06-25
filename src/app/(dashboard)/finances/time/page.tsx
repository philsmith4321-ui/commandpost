import { getDb } from '@/lib/db';
import { getTimeStats, getTimeEntriesFiltered } from '@/lib/queries/time-queries';
import { listSavedFilters } from '@/lib/queries/saved-filter-queries';
import { FinanceTabs } from '@/components/finance-tabs';
import { BulkTimeTable } from '@/components/bulk-time-table';
import { SavedFilters } from '@/components/saved-filters';

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
      {(() => {
        const totalHours = entries.reduce((s, e) => s + e.duration_minutes, 0) / 60;
        const totalRevenue = entries.reduce((s, e) => s + (e.duration_minutes * e.hourly_rate / 60), 0);
        const effectiveRate = totalHours > 0 ? totalRevenue / totalHours : 0;

        // Weekly breakdown for last 4 weeks
        const weeks: { label: string; hours: number }[] = [];
        for (let w = 0; w < 4; w++) {
          const end = new Date();
          end.setDate(end.getDate() - w * 7);
          const start = new Date(end);
          start.setDate(start.getDate() - 6);
          const startStr = start.toISOString().split('T')[0];
          const endStr = end.toISOString().split('T')[0];
          const weekEntries = entries.filter((e) => e.entry_date >= startStr && e.entry_date <= endStr);
          const weekHours = weekEntries.reduce((s, e) => s + e.duration_minutes, 0) / 60;
          weeks.push({ label: w === 0 ? 'This week' : w === 1 ? 'Last week' : `${w} weeks ago`, hours: weekHours });
        }

        return (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
              <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
                <p className="text-xs text-gray-500 uppercase mb-1">Hours This Month</p>
                <p className="text-2xl font-bold text-white">{stats.hoursThisMonth.toFixed(1)}h</p>
              </div>
              <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
                <p className="text-xs text-gray-500 uppercase mb-1">Uninvoiced</p>
                <p className="text-2xl font-bold text-yellow-400">${stats.uninvoicedTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                <p className="text-xs text-gray-500">{stats.uninvoicedHours.toFixed(1)}h</p>
              </div>
              <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
                <p className="text-xs text-gray-500 uppercase mb-1">Total Hours</p>
                <p className="text-2xl font-bold text-white">{totalHours.toFixed(1)}h</p>
              </div>
              <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
                <p className="text-xs text-gray-500 uppercase mb-1">Total Revenue</p>
                <p className="text-2xl font-bold text-green-400">${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              </div>
              <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
                <p className="text-xs text-gray-500 uppercase mb-1">Effective Rate</p>
                <p className="text-2xl font-bold text-white">${effectiveRate.toFixed(0)}/hr</p>
              </div>
            </div>

            {/* Weekly breakdown */}
            <div className="mb-6 p-4 bg-gray-900 border border-gray-800 rounded-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Weekly Hours</h3>
              <div className="flex items-end gap-3 h-16">
                {weeks.reverse().map((w, i) => {
                  const maxH = Math.max(...weeks.map(ww => ww.hours), 1);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs text-gray-500">{w.hours.toFixed(1)}h</span>
                      <div className="w-full bg-blue-600/50 rounded-t" style={{ height: `${(w.hours / maxH) * 48}px` }} />
                      <span className="text-xs text-gray-600 truncate w-full text-center">{w.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        );
      })()}

      {/* Saved Filters */}
      <SavedFilters
        filters={listSavedFilters(db, '/finances/time')}
        page="/finances/time"
        currentParams={Object.entries(sp).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join('&')}
      />

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
