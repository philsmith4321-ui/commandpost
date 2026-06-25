import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getLeadById, listLeadNotes, getStageHistory } from '@/lib/queries/lead-queries';
import { deleteLeadAction, markLeadLostAction } from '@/lib/actions/lead-actions';
import { StatusBadge } from '@/components/status-badge';
import { LeadNotes } from '@/components/lead-notes';
import { StageHistory } from '@/components/stage-history';
import { ConvertToClient } from '@/components/convert-to-client';
import { isClaudeConfigured } from '@/lib/claude';
import { FollowUpDraft } from '@/components/follow-up-draft';

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const lead = getLeadById(db, Number(id));
  if (!lead) notFound();

  const notes = listLeadNotes(db, lead.id);
  const history = getStageHistory(db, lead.id);
  const claudeEnabled = isClaudeConfigured();

  return (
    <div className="p-4 sm:p-6">
      <Link href="/pipeline" className="text-sm text-gray-400 hover:text-white mb-4 inline-block">
        &larr; Back to Pipeline
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">{lead.business_name}</h2>
          {lead.contact_person && <p className="text-gray-400">{lead.contact_person}</p>}
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={lead.stage} />
          <Link href={`/pipeline/${lead.id}/edit`}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg hover:border-gray-600 transition-colors">
            Edit
          </Link>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Email</p>
          <p className="text-sm text-white">{lead.email || '—'}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Phone</p>
          <p className="text-sm text-white">{lead.phone || '—'}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Website</p>
          <p className="text-sm text-white">{lead.website || '—'}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Source</p>
          <p className="text-sm text-white capitalize">{lead.source}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Estimated Value</p>
          <p className="text-sm text-white">{lead.estimated_value ? `$${lead.estimated_value.toLocaleString()}` : '—'}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Follow-up Date</p>
          <p className={`text-sm ${lead.follow_up_date && new Date(lead.follow_up_date) < new Date() ? 'text-red-400' : 'text-white'}`}>
            {lead.follow_up_date || '—'}
          </p>
        </div>
      </div>

      {/* Actions for active leads */}
      {lead.stage !== 'won' && lead.stage !== 'lost' && (
        <div className="flex gap-3 mb-8">
          <ConvertToClient leadId={lead.id} />
          <details className="relative">
            <summary className="px-4 py-2 text-sm text-red-400 border border-red-900 rounded-lg hover:bg-red-900/20 cursor-pointer transition-colors list-none">
              Mark Lost
            </summary>
            <form action={markLeadLostAction}
              className="absolute top-full mt-2 left-0 bg-gray-900 border border-gray-800 rounded-lg p-4 z-10 w-64">
              <input type="hidden" name="id" value={lead.id} />
              <p className="text-sm text-gray-400 mb-2">Reason:</p>
              <select name="lost_reason" required
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white mb-3 focus:outline-none focus:border-blue-500">
                <option value="too_expensive">Too Expensive</option>
                <option value="competitor">Went with Competitor</option>
                <option value="timing">Bad Timing</option>
                <option value="ghosted">Ghosted</option>
                <option value="other">Other</option>
              </select>
              <button type="submit"
                className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors">
                Confirm Lost
              </button>
            </form>
          </details>
        </div>
      )}

      {lead.stage !== 'won' && lead.stage !== 'lost' && (
        <FollowUpDraft leadId={lead.id} isConfigured={claudeEnabled} />
      )}

      {/* Won/Lost info */}
      {lead.stage === 'won' && lead.converted_client_id && (
        <div className="p-4 bg-green-900/20 border border-green-800 rounded-lg mb-8">
          <p className="text-sm text-green-400">
            This lead was won and converted to{' '}
            <Link href={`/clients/${lead.converted_client_id}`} className="underline hover:text-green-300">
              Client #{lead.converted_client_id}
            </Link>
          </p>
        </div>
      )}

      {lead.stage === 'lost' && lead.lost_reason && (
        <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg mb-8">
          <p className="text-sm text-red-400">
            Lost reason: {lead.lost_reason.replace(/_/g, ' ')}
          </p>
        </div>
      )}

      <StageHistory history={history} />
      <LeadNotes leadId={lead.id} notes={notes} />

      {/* Delete */}
      <div className="mt-12 pt-6 border-t border-gray-800">
        <form action={deleteLeadAction}>
          <input type="hidden" name="id" value={lead.id} />
          <button type="submit"
            className="px-4 py-2 text-sm text-red-400 border border-red-900 rounded-lg hover:bg-red-900/20 transition-colors"
            onClick={(e) => { if (!confirm('Delete this lead?')) e.preventDefault(); }}>
            Delete Lead
          </button>
        </form>
      </div>
    </div>
  );
}
