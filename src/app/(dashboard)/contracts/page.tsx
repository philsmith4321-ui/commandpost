import Link from 'next/link';
import { getDb } from '@/lib/db';
import { listContracts, getExpiringContracts } from '@/lib/queries/contract-queries';
import { StatusBadge } from '@/components/status-badge';

export const dynamic = 'force-dynamic';

export default function ContractsPage() {
  const db = getDb();
  const contracts = listContracts(db);
  const expiring = getExpiringContracts(db, 30);

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86400000);

  const activeCount = contracts.filter(c => c.status === 'active').length;
  const expiredCount = contracts.filter(c => c.status === 'expired' || (c.expires_at && new Date(c.expires_at) < now)).length;

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-bold mb-6">Contracts</h1>

      {contracts.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
            <p className="text-xs text-gray-500 uppercase mb-1">Total</p>
            <p className="text-2xl font-bold text-white">{contracts.length}</p>
          </div>
          <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
            <p className="text-xs text-gray-500 uppercase mb-1">Active</p>
            <p className="text-2xl font-bold text-green-400">{activeCount}</p>
          </div>
          <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
            <p className="text-xs text-gray-500 uppercase mb-1">Expiring Soon</p>
            <p className={`text-2xl font-bold ${expiring.length > 0 ? 'text-yellow-400' : 'text-white'}`}>{expiring.length}</p>
          </div>
          <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
            <p className="text-xs text-gray-500 uppercase mb-1">Expired</p>
            <p className={`text-2xl font-bold ${expiredCount > 0 ? 'text-red-400' : 'text-white'}`}>{expiredCount}</p>
          </div>
        </div>
      )}

      {expiring.length > 0 && (
        <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-800/50 rounded-lg">
          <h3 className="text-sm font-medium text-yellow-400 mb-2">Contracts Expiring Within 30 Days</h3>
          <div className="space-y-1">
            {expiring.map(c => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <span className="text-white">{c.title} — {c.client_name}</span>
                <span className="text-yellow-300/70">{c.expires_at}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
