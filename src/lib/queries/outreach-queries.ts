import type Database from 'better-sqlite3';
import { getSetting, setSetting } from '@/lib/queries/settings-queries';
import { LANES, LANE_ORDER, isLaneId, type LaneId } from '@/lib/outreach/lanes';

const ACTIVE_LANE_KEY = 'outreach_active_lane';

export function getActiveLane(db: Database.Database): LaneId {
  const v = getSetting(db, ACTIVE_LANE_KEY);
  return isLaneId(v) ? v : LANE_ORDER[0];
}

export function setActiveLane(db: Database.Database, lane: LaneId): void {
  setSetting(db, ACTIVE_LANE_KEY, lane);
}

// Monday (local) of the week containing `d`, as YYYY-MM-DD.
export function weekStartOf(d = new Date()): string {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay(); // 0 Sun .. 6 Sat
  const diff = (day + 6) % 7; // days since Monday
  date.setDate(date.getDate() - diff);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export interface OutreachWeek {
  week_start: string;
  lane: LaneId;
  metrics: Record<string, number>;
  cadence: Record<string, boolean>;
}

export function getWeek(db: Database.Database, weekStart: string, lane: LaneId): OutreachWeek {
  const row = db
    .prepare('SELECT metrics, cadence FROM outreach_week WHERE week_start = ? AND lane = ?')
    .get(weekStart, lane) as { metrics: string; cadence: string } | undefined;
  const parse = (s: string | undefined): Record<string, number | boolean> => {
    if (!s) return {};
    try {
      const v = JSON.parse(s);
      return v && typeof v === 'object' ? v : {};
    } catch {
      return {};
    }
  };
  return {
    week_start: weekStart,
    lane,
    metrics: (parse(row?.metrics) as Record<string, number>) ?? {},
    cadence: (parse(row?.cadence) as Record<string, boolean>) ?? {},
  };
}

export function upsertWeek(
  db: Database.Database,
  weekStart: string,
  lane: LaneId,
  patch: { metrics?: Record<string, number>; cadence?: Record<string, boolean> }
): void {
  const current = getWeek(db, weekStart, lane);
  const metrics = { ...current.metrics, ...(patch.metrics ?? {}) };
  const cadence = { ...current.cadence, ...(patch.cadence ?? {}) };
  db.prepare(
    `INSERT INTO outreach_week (week_start, lane, metrics, cadence, updated_at)
     VALUES (@week_start, @lane, @metrics, @cadence, datetime('now'))
     ON CONFLICT(week_start, lane) DO UPDATE SET
       metrics = excluded.metrics,
       cadence = excluded.cadence,
       updated_at = datetime('now')`
  ).run({
    week_start: weekStart,
    lane,
    metrics: JSON.stringify(metrics),
    cadence: JSON.stringify(cadence),
  });
}

export interface DerivedStats {
  outreaches: number; // leads entering 'contacted' this week
  discoveryDone: number; // leads entering 'discovery' this week
  won: number; // leads entering 'won' this week
}

// Auto-derive what the lead pipeline can see, scoped to this lane's tagged leads.
export function deriveWeekStats(db: Database.Database, weekStart: string, lane: LaneId): DerivedStats {
  const countEnteringStage = (stage: string): number => {
    const row = db
      .prepare(
        `SELECT COUNT(*) AS c
         FROM lead_stage_history h
         JOIN leads l ON l.id = h.lead_id
         WHERE h.stage = ?
           AND l.lane = ?
           AND date(h.entered_at) >= date(?)
           AND date(h.entered_at) < date(?, '+7 days')`
      )
      .get(stage, lane, weekStart, weekStart) as { c: number };
    return row.c;
  };
  return {
    outreaches: countEnteringStage('contacted'),
    discoveryDone: countEnteringStage('discovery'),
    won: countEnteringStage('won'),
  };
}

export type MetricStatus = 'good' | 'warn' | 'danger' | 'empty';

export interface ComputedMetric {
  label: string;
  unit: '%' | 'count';
  display: string; // formatted value
  value: number | null;
  detail: string; // supporting line, e.g. "12 sent · 1 reply"
  status: MetricStatus;
  dangerTriggered: boolean;
  dangerLabel: string;
  target: string;
  // 0..1 progress for the bar (best-effort)
  progress: number;
}

export function computeMetric(lane: LaneId, week: OutreachWeek, derived: DerivedStats): ComputedMetric {
  const m = LANES[lane].leadingMetric;
  const get = (k: string) => Number(week.metrics[k] ?? 0);
  const base: Omit<ComputedMetric, 'value' | 'display' | 'detail' | 'status' | 'dangerTriggered' | 'progress'> = {
    label: m.label,
    unit: m.unit,
    dangerLabel: m.dangerLabel,
    target: m.target,
  };

  if (m.kind === 'rate') {
    const sends = get(m.inputs[0].key);
    const replies = get(m.inputs[1].key);
    const value = sends > 0 ? Math.round((replies / sends) * 1000) / 10 : null;
    const dangerTriggered = value !== null && m.danger !== undefined && value < m.danger;
    let status: MetricStatus = 'empty';
    if (value !== null) {
      if (dangerTriggered) status = 'danger';
      else if (m.targetMin !== undefined && value < m.targetMin) status = 'warn';
      else status = 'good';
    }
    return {
      ...base,
      value,
      display: value === null ? '—' : `${value}%`,
      detail: `${sends} sent · ${replies} ${replies === 1 ? 'reply' : 'replies'}`,
      status,
      dangerTriggered,
      progress: value === null || !m.targetMax ? 0 : Math.min(1, value / m.targetMax),
    };
  }

  if (m.kind === 'ratio') {
    const asks = get(m.inputs[0].key);
    const denom = m.ratioAgainst === 'discoveryDone' ? derived.discoveryDone : 0;
    const dangerTriggered = denom > 0 && asks < denom;
    let status: MetricStatus = 'empty';
    if (asks > 0 || denom > 0) status = dangerTriggered ? 'danger' : 'good';
    return {
      ...base,
      value: asks,
      display: `${asks}`,
      detail: denom > 0 ? `${asks} asks · ${denom} discovery calls` : `${asks} asks logged`,
      status,
      dangerTriggered,
      progress: denom > 0 ? Math.min(1, asks / denom) : asks > 0 ? 1 : 0,
    };
  }

  // count
  const primary = get(m.inputs[0].key);
  const secondary = m.inputs[1] ? get(m.inputs[1].key) : null;
  const dangerTriggered = m.targetMin !== undefined && primary < m.targetMin;
  let status: MetricStatus = 'empty';
  if (primary > 0 || (secondary ?? 0) > 0) status = dangerTriggered ? 'danger' : 'good';
  const detail =
    secondary !== null
      ? `${primary} ${m.inputs[0].label.toLowerCase().includes('post') ? 'posts' : ''} · ${secondary} ${m.inputs[1].label.toLowerCase().includes('cta') ? 'CTA responses' : 'completions'}`.replace(/\s+/g, ' ').trim()
      : `${primary} logged`;
  return {
    ...base,
    value: primary,
    display: `${primary}`,
    detail,
    status,
    dangerTriggered,
    progress: m.targetMin ? Math.min(1, primary / m.targetMin) : primary > 0 ? 1 : 0,
  };
}
