import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getProposalByToken, getProposalItems } from '@/lib/queries/proposal-queries';
import { ProposalAcceptButton } from './accept-button';

export const dynamic = 'force-dynamic';

export default async function PublicProposalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = getDb();
  const proposal = getProposalByToken(db, token);
  if (!proposal) notFound();

  const items = getProposalItems(db, proposal.id);
  const isExpired = proposal.valid_until && new Date(proposal.valid_until) < new Date();
  const canAccept = proposal.status === 'sent' && !isExpired;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{proposal.title}</h1>
        <p className="text-gray-500 text-sm mb-8">
          {proposal.lead_name || proposal.client_name}
          {proposal.valid_until && ` · Valid until ${proposal.valid_until}`}
        </p>

        {proposal.scope && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Scope</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{proposal.scope}</p>
          </section>
        )}

        {proposal.timeline && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Timeline</h2>
            <p className="text-gray-700">{proposal.timeline}</p>
          </section>
        )}

        {items.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Pricing</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-2 font-medium">Description</th>
                  <th className="pb-2 font-medium">Qty</th>
                  <th className="pb-2 font-medium">Rate</th>
                  <th className="pb-2 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="py-2 text-gray-900">{item.description}</td>
                    <td className="py-2 text-gray-600">{item.quantity}</td>
                    <td className="py-2 text-gray-600">${item.unit_price}</td>
                    <td className="py-2 text-gray-900 text-right">${item.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-300">
                  <td colSpan={3} className="pt-3 text-right font-semibold text-gray-900">Total</td>
                  <td className="pt-3 text-right font-bold text-gray-900">${proposal.total_amount.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </section>
        )}

        {proposal.status === 'accepted' && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
            This proposal has been accepted.
          </div>
        )}

        {isExpired && proposal.status === 'sent' && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            This proposal has expired.
          </div>
        )}

        {canAccept && <ProposalAcceptButton token={token} />}

        <footer className="text-center text-gray-400 text-xs mt-12">Powered by CommandPost</footer>
      </div>
    </div>
  );
}
