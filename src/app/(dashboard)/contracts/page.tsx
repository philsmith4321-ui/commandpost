import Link from 'next/link';
import { getDb } from '@/lib/db';
import { listContracts } from '@/lib/queries/contract-queries';
import { StatusBadge } from '@/components/status-badge';

export const dynamic = 'force-dynamic';

export default function ContractsPage() {
  const db = getDb();
  const contracts = listContracts(db);

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86400000);

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-bold mb-6">Contracts</h1>

      {contracts.length === 0 ? (
        <p className="text-gray-500 text-sm">No contracts yet. Contracts are created when proposals are accepted.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-left">
                <th className="p-3">Title</th>
                <th className="p-3">Client</th>
                <th className="p-3">Signed</th>
                <th className="p-3">Expires</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => {
                const isExpiringSoon = c.expires_at && new Date(c.expires_at) <= thirtyDaysFromNow && c.status === 'active';
                return (
                  <tr key={c.id} className={`border-b border-gray-800/50 ${isExpiringSoon ? 'bg-yellow-900/10' : ''}`}>
                    <td className="p-3 text-white">{c.title}</td>
                    <td className="p-3">
                      <Link href={`/clients/${c.client_id}`} className="text-gray-400 hover:text-white">{c.client_name}</Link>
                    </td>
                    <td className="p-3 text-gray-400">{c.signed_at}</td>
                    <td className="p-3 text-gray-400">
                      {c.expires_at || '—'}
                      {isExpiringSoon && <span className="ml-2 text-yellow-400 text-xs">Expiring soon</span>}
                    </td>
                    <td className="p-3"><StatusBadge status={c.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
