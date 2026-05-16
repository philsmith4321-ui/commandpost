import { getDb } from '@/lib/db';
import { getAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const sp = await searchParams;
  const db = getDb();
  const entries = getAuditLog(db, 200, sp.type || undefined);

  const entityTypes = ['invoice', 'client', 'lead', 'project', 'deliverable', 'proposal'];

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-bold mb-6">Audit Log</h1>

      <form className="flex gap-3 mb-6">
        <select name="type" defaultValue={sp.type || ''} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
          <option value="">All Types</option>
          {entityTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors">Filter</button>
      </form>

      {entries.length === 0 ? (
        <p className="text-gray-500 text-sm">No audit entries yet. Actions will be logged as you use the system.</p>
      ) : (
        <div className="space-y-1">
          {entries.map(entry => (
            <div key={entry.id} className="flex items-center gap-3 p-3 bg-gray-900 border border-gray-800 rounded-lg">
              <span className="text-xs px-2 py-0.5 bg-gray-800 text-gray-400 rounded">{entry.entity_type}</span>
              <span className="text-sm text-white">{entry.action}</span>
              {entry.details && <span className="text-sm text-gray-400">— {entry.details}</span>}
              <span className="ml-auto text-xs text-gray-500">{new Date(entry.created_at + 'Z').toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
