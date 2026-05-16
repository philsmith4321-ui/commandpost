import Link from 'next/link';
import { getDb } from '@/lib/db';
import { listProposals } from '@/lib/queries/proposal-queries';
import { StatusBadge } from '@/components/status-badge';

export const dynamic = 'force-dynamic';

export default async function ProposalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const db = getDb();
  const proposals = listProposals(db, sp.status || undefined);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Proposals</h1>
        <Link href="/proposals/new" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors">
          New Proposal
        </Link>
      </div>

      <form className="flex gap-3 mb-6">
        <select name="status" defaultValue={sp.status || ''} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="expired">Expired</option>
        </select>
        <button type="submit" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors">Filter</button>
      </form>

      {proposals.length === 0 ? (
        <p className="text-gray-500 text-sm">No proposals found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-left">
                <th className="p-3">Title</th>
                <th className="p-3">For</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Status</th>
                <th className="p-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((p) => (
                <tr key={p.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                  <td className="p-3">
                    <Link href={`/proposals/${p.id}`} className="text-white hover:text-blue-400">{p.title}</Link>
                  </td>
                  <td className="p-3 text-gray-400">{p.lead_name || p.client_name || '—'}</td>
                  <td className="p-3 text-white">${p.total_amount.toLocaleString()}</td>
                  <td className="p-3"><StatusBadge status={p.status} /></td>
                  <td className="p-3 text-gray-500">{p.created_at.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
