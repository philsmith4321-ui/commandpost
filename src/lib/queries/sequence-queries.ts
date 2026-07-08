import type Database from 'better-sqlite3';
import type { SequenceStep } from '@/lib/outreach/sequence';

export interface SequenceLead {
  id: number;
  business_name: string | null;
  contact_person: string | null;
  email: string | null;
  replied_at: string | null;
  do_not_email: number | null;
  sequence_enrolled_at: string | null;
  steps_sent: number;        // ok sends so far
  first_sent_at: string | null;
  last_sent_at: string | null;
  pending_error: string | null; // error on the next step's failed attempt, if any
}

const BASE = `SELECT l.id, l.business_name, l.contact_person, l.email, l.replied_at,
  l.do_not_email, l.sequence_enrolled_at,
  (SELECT COUNT(*) FROM sequence_sends s WHERE s.lead_id = l.id AND s.ok = 1) AS steps_sent,
  (SELECT MIN(s.sent_at) FROM sequence_sends s WHERE s.lead_id = l.id AND s.ok = 1) AS first_sent_at,
  (SELECT MAX(s.sent_at) FROM sequence_sends s WHERE s.lead_id = l.id AND s.ok = 1) AS last_sent_at,
  (SELECT s.error FROM sequence_sends s WHERE s.lead_id = l.id AND s.ok = 0 LIMIT 1) AS pending_error
  FROM leads l`;

export function enroll(db: Database.Database, id: number): void {
  db.prepare(`UPDATE leads SET sequence_enrolled_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ? AND sequence_enrolled_at IS NULL
      AND email IS NOT NULL AND trim(email) <> '' AND do_not_email = 0`).run(id);
}

export function unenroll(db: Database.Database, id: number): void {
  db.prepare(`UPDATE leads SET sequence_enrolled_at = NULL, updated_at = datetime('now') WHERE id = ?`).run(id);
}

// Enroll every eligible lead at once; returns how many were enrolled.
export function enrollAllEligible(db: Database.Database): number {
  return db.prepare(`UPDATE leads SET sequence_enrolled_at = datetime('now'), updated_at = datetime('now')
    WHERE sequence_enrolled_at IS NULL AND email IS NOT NULL AND trim(email) <> ''
      AND do_not_email = 0 AND replied_at IS NULL`).run().changes;
}

export function listEnrolled(db: Database.Database): SequenceLead[] {
  return db.prepare(`${BASE} WHERE l.sequence_enrolled_at IS NOT NULL
    ORDER BY l.sequence_enrolled_at, l.id`).all() as SequenceLead[];
}

export function eligibleCount(db: Database.Database): number {
  return (db.prepare(`SELECT COUNT(*) n FROM leads
    WHERE sequence_enrolled_at IS NULL AND email IS NOT NULL AND trim(email) <> ''
      AND do_not_email = 0 AND replied_at IS NULL`).get() as { n: number }).n;
}

export interface EligibleLead {
  id: number; business_name: string | null; contact_person: string | null;
  email: string | null; city: string | null; state: string | null; category: string | null;
}

// Every lead the operator could hand-pick into the sequence, A-Z by name.
export function listEligible(db: Database.Database): EligibleLead[] {
  return db.prepare(`SELECT id, business_name, contact_person, email, city, state, category
    FROM leads
    WHERE sequence_enrolled_at IS NULL AND email IS NOT NULL AND trim(email) <> ''
      AND do_not_email = 0 AND replied_at IS NULL
    ORDER BY business_name COLLATE NOCASE, id`).all() as EligibleLead[];
}

// Sends made by the sequence today (counts toward the shared daily cap).
// sent_at is a UTC stamp, so convert it to localtime before comparing dates.
export function sequenceSentTodayCount(db: Database.Database): number {
  return (db.prepare(`SELECT COUNT(*) n FROM sequence_sends
    WHERE ok = 1 AND date(sent_at, 'localtime') = date('now', 'localtime')`).get() as { n: number }).n;
}

// The next step number a lead is waiting on, given how many ok sends it has.
export function pendingStep(l: SequenceLead, steps: SequenceStep[]): SequenceStep | null {
  return steps[l.steps_sent] ?? null;
}

// True when the lead's pending step has reached its dayOffset. Step 1 is anchored
// to enrollment; follow-ups are anchored to when step 1 ACTUALLY sent — a lead can
// wait days in the daily-cap backlog before its first send, and anchoring to
// enrollment would fire all the overdue steps back-to-back on first touch.
function isDue(l: SequenceLead, step: SequenceStep, db: Database.Database): boolean {
  const anchor = l.first_sent_at ?? l.sequence_enrolled_at;
  const row = db.prepare(
    `SELECT datetime('now') >= datetime(?, '+' || ? || ' days') AS due`
  ).get(anchor, step.dayOffset) as { due: number };
  return !!row.due;
}

// Oldest-enrolled lead with a due step, skipping replied/suppressed leads and
// leads whose pending step already has a failed attempt (needs manual retry).
export function nextDueSequenceSend(
  db: Database.Database,
  steps: SequenceStep[]
): { lead: SequenceLead; step: SequenceStep } | null {
  const rows = db.prepare(`${BASE}
    WHERE l.sequence_enrolled_at IS NOT NULL AND l.replied_at IS NULL
      AND l.do_not_email = 0 AND l.email IS NOT NULL AND trim(l.email) <> ''
    ORDER BY l.sequence_enrolled_at, l.id`).all() as SequenceLead[];
  for (const lead of rows) {
    if (lead.pending_error) continue;
    const step = pendingStep(lead, steps);
    if (!step) continue; // sequence finished
    if (isDue(lead, step, db)) return { lead, step };
  }
  return null;
}

export function recordSequenceSend(db: Database.Database, leadId: number, step: number): void {
  db.prepare(`INSERT INTO sequence_sends (lead_id, step, ok) VALUES (?, ?, 1)`).run(leadId, step);
}

export function recordSequenceFailure(db: Database.Database, leadId: number, step: number, err: string): void {
  db.prepare(`INSERT INTO sequence_sends (lead_id, step, ok, error) VALUES (?, ?, 0, ?)`)
    .run(leadId, step, err.slice(0, 500));
}

// Clear a failed attempt so the tick will retry that step.
export function retrySequenceStep(db: Database.Database, leadId: number): void {
  db.prepare(`DELETE FROM sequence_sends WHERE lead_id = ? AND ok = 0`).run(leadId);
}
