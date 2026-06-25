import Link from 'next/link';
import { getDb } from '@/lib/db';
import { listLeadsByStage, getPipelineSummary, findDuplicateLeads } from '@/lib/queries/lead-queries';
import { KanbanBoard } from '@/components/kanban-board';
import { ExportButton } from '@/components/export-button';

export const dynamic = 'force-dynamic';

export default function PipelinePage() {
  const db = getDb();
  const leadsByStage = listLeadsByStage(db);
  const summary = getPipelineSummary(db);
  const duplicates = findDuplicateLeads(db);

  // Get latest stage entry dates for aging calculation
  const allLeadIds = Object.values(leadsByStage).flat().map((l) => l.id);
  const stageEnteredDates: Record<number, string> = {};
  for (const id of allLeadIds) {
    const latest = db.prepare(
      'SELECT entered_at FROM lead_stage_history WHERE lead_id = ? ORDER BY entered_at DESC LIMIT 1'
    ).get(id) as { entered_at: string } | undefined;
    if (latest) stageEnteredDates[id] = latest.entered_at;
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Pipeline</h2>
          <p className="text-sm text-gray-400">
            {summary.totalLeads} leads &middot; ${summary.totalValue.toLocaleString()} total value
            {summary.needsFollowUp > 0 && (
              <span className="text-yellow-400"> &middot; {summary.needsFollowUp} need follow-up</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton href="/api/reports/pipeline" label="Pipeline Report" format="pdf" small />
          <Link
            href="/pipeline/new"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + New Lead
          </Link>
        </div>
      </div>

      {duplicates.length > 0 && (
        <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-800/50 rounded-lg">
          <h3 className="text-sm font-medium text-yellow-400 mb-2">Possible Duplicate Leads ({duplicates.length})</h3>
          <div className="space-y-2">
            {duplicates.map((group, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-yellow-300/70">{group.email || group.business_name}:</span>
                {group.leads.map(l => (
                  <a key={l.id} href={`/pipeline/${l.id}`} className="text-yellow-400 hover:text-yellow-300 underline">
                    {l.business_name}
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <KanbanBoard leadsByStage={leadsByStage} stageEnteredDates={stageEnteredDates} />
    </div>
  );
}
