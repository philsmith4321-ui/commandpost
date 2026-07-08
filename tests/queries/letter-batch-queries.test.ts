import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  eligibleLetterLeads, saveLetterDraft, markLetterBatchSent,
} from '@/lib/queries/letter-batch-queries';

function freshDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE leads (
      id INTEGER PRIMARY KEY, business_name TEXT, contact_person TEXT,
      street TEXT, city TEXT, state TEXT, postal_code TEXT,
      lane TEXT, segment TEXT, category TEXT,
      employee_min INTEGER, employee_max INTEGER, website TEXT,
      email_status TEXT, email_queued_at TEXT, sequence_enrolled_at TEXT,
      do_not_email INTEGER NOT NULL DEFAULT 0,
      draft_letter TEXT, letter_status TEXT, letter_sent_at_q TEXT,
      letter_batch_date TEXT, updated_at TEXT,
      research_notes TEXT, researched_at TEXT
    );
    CREATE TABLE outreach_touches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      channel TEXT NOT NULL CHECK(channel IN ('letter','email','phone','linkedin','fb')),
      sent_at TEXT NOT NULL DEFAULT (datetime('now')),
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const ins = db.prepare(`INSERT INTO leads
    (business_name, contact_person, street, city, state, postal_code, email_status, email_queued_at, do_not_email, letter_status)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);
  // 1: queued, complete address — eligible
  ins.run('Acme HVAC', 'Brett Boston', '12 Main St', 'Hendersonville', 'TN', '37075', 'queued', '2026-06-01 10:00:00', 0, null);
  // 2: email already sent (was queued) — still eligible, queued LATER than #1
  ins.run('Beta Roofing', null, '9 Oak Ave', 'Gallatin', 'TN', '37066', 'sent', '2026-06-02 10:00:00', 0, null);
  // 3: complete but never entered the email queue — NOT eligible
  ins.run('Gamma Law', 'Ann Lee', '4 Elm St', 'Nashville', 'TN', '37201', 'draft', null, 0, null);
  // 4: queued but missing street — NOT eligible
  ins.run('Delta Dental', 'Joe Ray', null, 'Franklin', 'TN', '37064', 'queued', '2026-06-03 10:00:00', 0, null);
  // 5: queued, complete, but do_not_email — NOT eligible
  ins.run('Epsilon Gym', 'Kim Fox', '7 Pine Rd', 'Lebanon', 'TN', '37087', 'queued', '2026-06-04 10:00:00', 1, null);
  // 6: queued, complete, but letter already sent — NOT eligible
  ins.run('Zeta Cafe', 'Lou Poe', '3 Ash Ln', 'Smyrna', 'TN', '37167', 'queued', '2026-06-05 10:00:00', 0, 'sent');
  // 7: queued but blank business name — NOT eligible
  ins.run('  ', 'Max Orr', '8 Fir Ct', 'Hermitage', 'TN', '37076', 'queued', '2026-06-06 10:00:00', 0, null);
  // 8: never in the single-draft queue but ENROLLED in the drip sequence
  // (production's "queued for email" state) — eligible, entered EARLIEST
  db.prepare(`INSERT INTO leads
    (business_name, contact_person, street, city, state, postal_code, sequence_enrolled_at)
    VALUES (?,?,?,?,?,?,?)`)
    .run('Theta Vet', 'Sue Day', '5 Birch Blvd', 'Mt. Juliet', 'TN', '37122', '2026-05-30 09:00:00');
  return db;
}

describe('eligibleLetterLeads', () => {
  let db: Database.Database;
  beforeEach(() => { db = freshDb(); });

  it('returns queue-entered OR sequence-enrolled, mailable, unlettered leads, oldest first', () => {
    expect(eligibleLetterLeads(db, 10).map((l) => l.id)).toEqual([8, 1, 2]);
  });

  it('honors the limit', () => {
    expect(eligibleLetterLeads(db, 1).map((l) => l.id)).toEqual([8]);
  });
});

describe('saveLetterDraft', () => {
  it('stores the draft text', () => {
    const db = freshDb();
    saveLetterDraft(db, 1, 'Dear Brett...');
    expect(eligibleLetterLeads(db, 10).find((l) => l.id === 1)?.draft_letter).toBe('Dear Brett...');
  });
});

describe('markLetterBatchSent', () => {
  it('stamps status/date and logs a letter touch per lead, removing them from the pool', () => {
    const db = freshDb();
    markLetterBatchSent(db, [8, 1, 2], '2026-07-03');
    expect(eligibleLetterLeads(db, 10)).toEqual([]);
    const row = db.prepare('SELECT letter_status, letter_sent_at_q, letter_batch_date FROM leads WHERE id=1')
      .get() as { letter_status: string; letter_sent_at_q: string; letter_batch_date: string };
    expect(row.letter_status).toBe('sent');
    expect(row.letter_sent_at_q).toBeTruthy();
    expect(row.letter_batch_date).toBe('2026-07-03');
    const touches = db.prepare("SELECT lead_id FROM outreach_touches WHERE channel='letter' ORDER BY lead_id")
      .all() as { lead_id: number }[];
    expect(touches.map((t) => t.lead_id)).toEqual([1, 2, 8]);
  });
});
