import { getDb } from '@/lib/db';
import {
  getActiveLane,
  getWeek,
  deriveWeekStats,
  computeMetric,
  weekStartOf,
} from '@/lib/queries/outreach-queries';
import { OutreachCockpit } from '@/components/outreach-cockpit';

export const dynamic = 'force-dynamic';

export default async function OutreachPage() {
  const db = getDb();
  const lane = getActiveLane(db);
  const weekStart = weekStartOf();
  const week = getWeek(db, weekStart, lane);
  const derived = deriveWeekStats(db, weekStart, lane);
  const metric = computeMetric(lane, week, derived);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-start gap-3 mb-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-600 text-xl">🎯</div>
        <div>
          <h2 className="text-2xl font-bold">Outreach</h2>
          <p className="text-sm text-gray-400">The Four Lanes — one leading metric, a weekly rhythm, and the play for when the well runs dry.</p>
        </div>
      </div>

      <OutreachCockpit
        initialLane={lane}
        weekStart={weekStart}
        initialWeek={week}
        initialDerived={derived}
        initialMetric={metric}
      />
    </div>
  );
}
