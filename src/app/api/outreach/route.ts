import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { isLaneId, type LaneId } from '@/lib/outreach/lanes';
import {
  getActiveLane,
  setActiveLane,
  getWeek,
  upsertWeek,
  deriveWeekStats,
  computeMetric,
  weekStartOf,
} from '@/lib/queries/outreach-queries';

export async function GET(request: NextRequest) {
  const db = getDb();
  const param = request.nextUrl.searchParams.get('lane');
  const lane: LaneId = isLaneId(param) ? param : getActiveLane(db);
  const weekStart = weekStartOf();
  const week = getWeek(db, weekStart, lane);
  const derived = deriveWeekStats(db, weekStart, lane);
  const metric = computeMetric(lane, week, derived);
  return NextResponse.json({ activeLane: getActiveLane(db), lane, weekStart, week, derived, metric });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const db = getDb();

  // Set the operator's active lane.
  if (body.action === 'set-lane') {
    if (!isLaneId(body.lane)) return NextResponse.json({ error: 'invalid lane' }, { status: 400 });
    setActiveLane(db, body.lane);
    return NextResponse.json({ ok: true, activeLane: body.lane });
  }

  // Save this week's manual metrics and/or cadence checklist for a lane.
  if (body.action === 'save-week') {
    if (!isLaneId(body.lane)) return NextResponse.json({ error: 'invalid lane' }, { status: 400 });
    const lane = body.lane as LaneId;
    const weekStart = typeof body.weekStart === 'string' && body.weekStart ? body.weekStart : weekStartOf();

    const metrics: Record<string, number> = {};
    if (body.metrics && typeof body.metrics === 'object') {
      for (const [k, v] of Object.entries(body.metrics)) {
        const n = Number(v);
        if (Number.isFinite(n) && n >= 0) metrics[k] = Math.floor(n);
      }
    }
    const cadence: Record<string, boolean> = {};
    if (body.cadence && typeof body.cadence === 'object') {
      for (const [k, v] of Object.entries(body.cadence)) cadence[k] = Boolean(v);
    }

    upsertWeek(db, weekStart, lane, { metrics, cadence });
    const week = getWeek(db, weekStart, lane);
    const derived = deriveWeekStats(db, weekStart, lane);
    const metric = computeMetric(lane, week, derived);
    return NextResponse.json({ ok: true, week, derived, metric });
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
