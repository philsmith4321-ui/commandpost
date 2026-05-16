import Link from 'next/link';
import { getDb } from '@/lib/db';
import { getLeadScores } from '@/lib/queries/lead-queries';

export const dynamic = 'force-dynamic';

export default function LeadScoresPage() {
  const db = getDb();
  const leads = getLeadScores(db);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Lead Scores</h2>
        <Link href="/pipeline" className="text-sm text-gray-400 hover:text-white">&larr; Back to Pipeline</Link>
      </div>

      <p className="text-sm text-gray-500 mb-6">
        Leads scored 0-100 based on value (25), engagement (25), stage progress (25), and recency (25).
      </p>

      {leads.length === 0 ? (
        <p className="text-gray-500">No active leads in pipeline.</p>
      ) : (
        <div className="space-y-3">
          {leads.map((lead, i) => (
            <div key={lead.id} className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-6">#{i + 1}</span>
                  <Link href={`/pipeline/${lead.id}`} className="font-medium text-blue-400 hover:underline">
                    {lead.business_name}
                  </Link>
                  <span className="text-xs px-2 py-0.5 bg-gray-800 rounded text-gray-400">{lead.stage}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${lead.score >= 70 ? 'text-green-400' : lead.score >= 40 ? 'text-yellow-400' : 'text-gray-400'}`}>
                    {lead.score}
                  </span>
                  <span className="text-xs text-gray-600">/100</span>
                </div>
              </div>

              {/* Score breakdown bar */}
              <div className="flex h-2 rounded-full overflow-hidden bg-gray-800">
                <div className="bg-blue-500" style={{ width: `${lead.score_breakdown.value}%` }} title={`Value: ${lead.score_breakdown.value}`} />
                <div className="bg-purple-500" style={{ width: `${lead.score_breakdown.engagement}%` }} title={`Engagement: ${lead.score_breakdown.engagement}`} />
                <div className="bg-green-500" style={{ width: `${lead.score_breakdown.stage}%` }} title={`Stage: ${lead.score_breakdown.stage}`} />
                <div className="bg-yellow-500" style={{ width: `${lead.score_breakdown.recency}%` }} title={`Recency: ${lead.score_breakdown.recency}`} />
              </div>

              <div className="flex gap-4 mt-2 text-xs text-gray-600">
                <span>Value: {lead.score_breakdown.value}</span>
                <span>Engagement: {lead.score_breakdown.engagement}</span>
                <span>Stage: {lead.score_breakdown.stage}</span>
                <span>Recency: {lead.score_breakdown.recency}</span>
                {lead.estimated_value && <span className="ml-auto text-gray-500">${lead.estimated_value.toLocaleString()}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="mt-8 p-4 bg-gray-900 border border-gray-800 rounded-lg">
        <h3 className="text-sm font-medium mb-2">Score Legend</h3>
        <div className="flex gap-4 text-xs">
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-blue-500" /> Value (deal size)</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-purple-500" /> Engagement (notes)</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-green-500" /> Stage progress</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-yellow-500" /> Recency</div>
        </div>
      </div>
    </div>
  );
}
