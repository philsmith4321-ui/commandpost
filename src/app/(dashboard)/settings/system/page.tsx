import { getDb } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function SystemSettingsPage() {
  const db = getDb();

  // Get table stats
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[];
  const stats = tables.map(t => {
    const count = (db.prepare(`SELECT COUNT(*) as c FROM ${t.name}`).get() as any).c;
    return { name: t.name, count };
  });

  const totalRows = stats.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="p-4 sm:p-6 max-w-3xl">
      <Link href="/settings" className="text-sm text-gray-400 hover:text-white mb-4 inline-block">&larr; Back to Settings</Link>
      <h2 className="text-2xl font-bold mb-6">System</h2>

      {/* Backup section */}
      <div className="mb-8 p-4 bg-gray-900 border border-gray-800 rounded-lg">
        <h3 className="text-sm font-medium text-gray-400 uppercase mb-3">Database Backup</h3>
        <div className="flex gap-3">
          <a href="/api/backup" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium">
            Download Backup
          </a>
          <BackupButton />
        </div>
        <p className="text-xs text-gray-500 mt-2">Server-side backups are stored in data/backups/ (last 10 kept)</p>
      </div>

      {/* Database stats */}
      <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
        <h3 className="text-sm font-medium text-gray-400 uppercase mb-3">Database Statistics</h3>
        <p className="text-sm text-gray-300 mb-3">{tables.length} tables, {totalRows.toLocaleString()} total rows</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {stats.filter(s => s.count > 0 || ['clients', 'invoices', 'leads', 'projects', 'proposals'].includes(s.name)).map(s => (
            <div key={s.name} className="p-2 bg-gray-800 rounded text-xs">
              <span className="text-gray-400">{s.name}</span>
              <span className="float-right text-white font-medium">{s.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BackupButton() {
  return (
    <form action="/api/backup" method="POST">
      <button type="submit" className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium">
        Create Server Backup
      </button>
    </form>
  );
}
