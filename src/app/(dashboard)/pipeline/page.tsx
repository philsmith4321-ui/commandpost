import Link from 'next/link';
import { getDb } from '@/lib/db';
import { listLeadsByStage, getPipelineSummary } from '@/lib/queries/lead-queries';
import { KanbanBoard } from '@/components/kanban-board';

export const dynamic = 'force-dynamic';

export default function PipelinePage() {
  const db = getDb();
  const leadsByStage = listLeadsByStage(db);
  const summary = getPipelineSummary(db);

  // Get latest stage entry dates for aging calculation
  const allLeadIds = Object.values(leadsByStage).flat().map((l) => l.id);
  const stageEnteredDates: Record<number, string> = {};
  for (const id of allLeadIds) {
    const latest = db.prepare(
      'SELECT entered_at FROM lead_stage_history WHERE lead_id = ? ORDER BY entered_at DESC LIMIT 1'
    ).get(id) as any;
    if (latest) stageEnteredDates[id] = latest.entered_at;
  }

  return (
    <div className="p-6">
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
        <Link
          href="/pipeline/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + New Lead
        </Link>
      </div>

      <KanbanBoard leadsByStage={leadsByStage} stageEnteredDates={stageEnteredDates} />
    </div>
  );
}
