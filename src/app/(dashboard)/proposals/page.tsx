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

  const allProposals = sp.status ? listProposals(db) : proposals;
  const draftCount = allProposals.filter(p => p.status === 'draft').length;
  const sentCount = allProposals.filter(p => p.status === 'sent').length;
  const acceptedCount = allProposals.filter(p => p.status === 'accepted').length;
  const totalPendingValue = allProposals.filter(p => p.status === 'sent').reduce((s, p) => s + p.total_amount, 0);

  const today = new Date().toISOString().split('T')[0];

  const tabs = [
    { label: 'All', value: '', count: allProposals.length },
    { label: 'Draft', value: 'draft', count: draftCount },
    { label: 'Sent', value: 'sent', count: sentCount },
    { label: 'Accepted', value: 'accepted', count: acceptedCount },
    { label: 'Rejected', value: 'rejected', count: allProposals.filter(p => p.status === 'rejected').length },
  ];

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Proposals</h1>
        <div className="flex items-center gap-2">
          <Link href="/proposals/templates" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors">
            Templates
          </Link>
          <Link href="/proposals/new" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors">
            New Proposal
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Draft</p>
          <p className="text-2xl font-bold text-gray-300">{draftCount}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Awaiting Response</p>
          <p className="text-2xl font-bold text-yellow-400">{sentCount}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Pending Value</p>
          <p className="text-2xl font-bold text-white">${totalPendingValue.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Accepted</p>
          <p className="text-2xl font-bold text-green-400">{acceptedCount}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map(tab => (
          <Link key={tab.value} href={tab.value ? `/proposals?status=${tab.value}` : '/proposals'}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              (sp.status || '') === tab.value ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}>
            {tab.label} ({tab.count})
          </Link>
        ))}
      </div>

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
                <th className="p-3">Valid Until</th>
                <th className="p-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((p) => {
                const isExpiring = p.status === 'sent' && p.valid_until && p.valid_until <= today;
                return (
                  <tr key={p.id} className={`border-b border-gray-800/50 hover:bg-gray-900/50 ${isExpiring ? 'bg-red-900/10' : ''}`}>
                    <td className="p-3">
                      <Link href={`/proposals/${p.id}`} className="text-white hover:text-blue-400">{p.title}</Link>
                    </td>
                    <td className="p-3 text-gray-400">{p.lead_name || p.client_name || '—'}</td>
                    <td className="p-3 text-white">${p.total_amount.toLocaleString()}</td>
                    <td className="p-3"><StatusBadge status={p.status} /></td>
                    <td className="p-3">
                      {p.valid_until ? (
                        <span className={isExpiring ? 'text-red-400' : 'text-gray-500'}>
                          {p.valid_until}{isExpiring ? ' (expired)' : ''}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="p-3 text-gray-500">{p.created_at.slice(0, 10)}</td>
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
