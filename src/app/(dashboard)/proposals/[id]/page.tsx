import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getProposalById, getProposalItems } from '@/lib/queries/proposal-queries';
import { markProposalSentAction, markProposalRejectedAction } from '@/lib/actions/proposal-actions';
import { StatusBadge } from '@/components/status-badge';

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const proposal = getProposalById(db, Number(id));
  if (!proposal) notFound();

  const items = getProposalItems(db, Number(id));
  const portalUrl = proposal.token ? `/proposals/view/${proposal.token}` : null;

  return (
    <div className="p-4 sm:p-6 max-w-3xl">
      <Link href="/proposals" className="text-sm text-gray-400 hover:text-white mb-4 inline-block">&larr; Back to Proposals</Link>

      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">{proposal.title}</h1>
        <StatusBadge status={proposal.status} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-3 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-gray-500 text-xs uppercase">For</p>
          <p className="text-white text-sm">{proposal.lead_name || proposal.client_name || '—'}</p>
        </div>
        <div className="p-3 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-gray-500 text-xs uppercase">Timeline</p>
          <p className="text-white text-sm">{proposal.timeline || '—'}</p>
        </div>
        <div className="p-3 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-gray-500 text-xs uppercase">Valid Until</p>
          <p className="text-white text-sm">{proposal.valid_until || '—'}</p>
        </div>
        <div className="p-3 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-gray-500 text-xs uppercase">Total</p>
          <p className="text-white text-sm font-medium">${proposal.total_amount.toLocaleString()}</p>
        </div>
      </div>

      {proposal.scope && (
        <div className="mb-6 p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-gray-500 text-xs uppercase mb-2">Scope</p>
          <p className="text-white text-sm whitespace-pre-wrap">{proposal.scope}</p>
        </div>
      )}

      {items.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm text-gray-400 uppercase mb-2">Line Items</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-left">
                <th className="p-2">Description</th>
                <th className="p-2">Qty</th>
                <th className="p-2">Rate</th>
                <th className="p-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-gray-800/50">
                  <td className="p-2 text-white">{item.description}</td>
                  <td className="p-2 text-gray-400">{item.quantity}</td>
                  <td className="p-2 text-gray-400">${item.unit_price}</td>
                  <td className="p-2 text-white text-right">${item.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {proposal.accepted_at && (
        <div className="mb-6 p-4 bg-green-900/20 border border-green-800 rounded-lg">
          <p className="text-green-400 text-sm">Accepted on {proposal.accepted_at.slice(0, 10)} from {proposal.accepted_ip}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {proposal.status === 'draft' && (
          <form action={markProposalSentAction}>
            <input type="hidden" name="id" value={proposal.id} />
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors">
              Mark as Sent
            </button>
          </form>
        )}
        {portalUrl && (
          <Link href={portalUrl} target="_blank" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors">
            View Public Link
          </Link>
        )}
        {proposal.status === 'sent' && (
          <form action={markProposalRejectedAction}>
            <input type="hidden" name="id" value={proposal.id} />
            <button type="submit" className="px-4 py-2 bg-red-900/50 hover:bg-red-900 text-red-400 text-sm rounded-lg transition-colors">
              Mark Rejected
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
