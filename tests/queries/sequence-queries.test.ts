import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  enroll, unenroll, enrollAllEligible, listEnrolled, listEligible, eligibleCount,
  nextDueSequenceSend, recordSequenceSend, recordSequenceFailure,
  retrySequenceStep, sequenceSentTodayCount,
} from '@/lib/queries/sequence-queries';
import { DEFAULT_EMAIL_SEQUENCE } from '@/lib/outreach/sequence';

function freshDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE leads (
      id INTEGER PRIMARY KEY, business_name TEXT, contact_person TEXT, email TEXT,
      city TEXT, state TEXT, category TEXT,
      stage TEXT DEFAULT 'new', replied_at TEXT,
      do_not_email INTEGER NOT NULL DEFAULT 0, sequence_enrolled_at TEXT, updated_at TEXT
    );
    CREATE TABLE sequence_sends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      step INTEGER NOT NULL, ok INTEGER NOT NULL DEFAULT 1, error TEXT,
      sent_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(lead_id, step, ok)
    );
  `);
  const ins = db.prepare('INSERT INTO leads (business_name, contact_person, email) VALUES (?,?,?)');
  ins.run('Acme HVAC', 'Brett Boston', 'brett@acme.com');   // 1
  ins.run('Beta Roofing', null, 'info@beta.com');           // 2
  ins.run('NoEmail Co', 'Sam', null);                       // 3
  return db;
}

const STEPS = DEFAULT_EMAIL_SEQUENCE;

describe('enrollment', () => {
  let db: Database.Database;
  beforeEach(() => { db = freshDb(); });

  it('enroll stamps eligible leads only; unenroll clears', () => {
    enroll(db, 1); enroll(db, 3); // 3 has no email
    expect(listEnrolled(db).map((l) => l.id)).toEqual([1]);
    unenroll(db, 1);
    expect(listEnrolled(db)).toEqual([]);
  });

  it('enroll refuses do_not_email and re-enroll does not reset the clock', () => {
    db.prepare('UPDATE leads SET do_not_email=1 WHERE id=1').run();
    enroll(db, 1);
    expect(listEnrolled(db)).toEqual([]);
    enroll(db, 2);
    db.prepare("UPDATE leads SET sequence_enrolled_at='2026-01-01 00:00:00' WHERE id=2").run();
    enroll(db, 2); // second call must not overwrite
    expect(listEnrolled(db)[0].sequence_enrolled_at).toBe('2026-01-01 00:00:00');
  });

  it('enrollAllEligible enrolls emailable, unreplied, unsuppressed leads', () => {
    db.prepare("UPDATE leads SET replied_at=datetime('now') WHERE id=2").run();
    expect(eligibleCount(db)).toBe(1);
    expect(enrollAllEligible(db)).toBe(1);
    expect(listEnrolled(db).map((l) => l.id)).toEqual([1]);
  });

  it('listEligible returns pickable leads A-Z and drops them once enrolled', () => {
    expect(listEligible(db).map((l) => l.business_name)).toEqual(['Acme HVAC', 'Beta Roofing']);
    enroll(db, 1);
    expect(listEligible(db).map((l) => l.id)).toEqual([2]);
    db.prepare("UPDATE leads SET replied_at=datetime('now') WHERE id=2").run();
    expect(listEligible(db)).toEqual([]);
  });
});

describe('due logic', () => {
  let db: Database.Database;
  beforeEach(() => { db = freshDb(); });

  it('step 1 is due immediately on enrollment; later steps wait their offset', () => {
    enroll(db, 1);
    const due = nextDueSequenceSend(db, STEPS);
    expect(due?.lead.id).toBe(1);
    expect(due?.step.step).toBe(1);
    recordSequenceSend(db, 1, 1);
    // step 2 (offset 3 days) not due yet
    expect(nextDueSequenceSend(db, STEPS)).toBeNull();
    // backdating ENROLLMENT alone must NOT make step 2 due — follow-ups
    // anchor to the first send, not enrollment (backlog pileup fix).
    db.prepare("UPDATE leads SET sequence_enrolled_at=datetime('now','-4 days') WHERE id=1").run();
    expect(nextDueSequenceSend(db, STEPS)).toBeNull();
    // backdate the step-1 send 4 days: step 2 due
    db.prepare("UPDATE sequence_sends SET sent_at=datetime('now','-4 days') WHERE lead_id=1").run();
    expect(nextDueSequenceSend(db, STEPS)?.step.step).toBe(2);
  });

  it('skips replied and suppressed leads, finishes after step 5', () => {
    enroll(db, 1);
    db.prepare("UPDATE leads SET sequence_enrolled_at=datetime('now','-30 days') WHERE id=1").run();
    db.prepare("UPDATE leads SET replied_at=datetime('now') WHERE id=1").run();
    expect(nextDueSequenceSend(db, STEPS)).toBeNull();
    db.prepare('UPDATE leads SET replied_at=NULL WHERE id=1').run();
    for (let s = 1; s <= 5; s++) recordSequenceSend(db, 1, s);
    expect(nextDueSequenceSend(db, STEPS)).toBeNull();
    expect(listEnrolled(db)[0].steps_sent).toBe(5);
  });

  it('a failed attempt parks the lead until retried', () => {
    enroll(db, 1);
    recordSequenceFailure(db, 1, 1, 'gmail-api 400: boom');
    expect(nextDueSequenceSend(db, STEPS)).toBeNull();
    expect(listEnrolled(db)[0].pending_error).toContain('boom');
    retrySequenceStep(db, 1);
    expect(nextDueSequenceSend(db, STEPS)?.step.step).toBe(1);
  });

  it('oldest enrollment goes first and today count tracks ok sends only', () => {
    enroll(db, 1); enroll(db, 2);
    db.prepare("UPDATE leads SET sequence_enrolled_at=datetime('now','-2 days') WHERE id=2").run();
    expect(nextDueSequenceSend(db, STEPS)?.lead.id).toBe(2);
    recordSequenceSend(db, 2, 1);
    recordSequenceFailure(db, 1, 1, 'x');
    expect(sequenceSentTodayCount(db)).toBe(1);
  });
});
