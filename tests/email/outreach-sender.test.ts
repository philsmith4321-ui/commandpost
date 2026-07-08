import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { sendOneTick, type Transport } from '@/lib/email/outreach-sender';

function freshDb() {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE leads (
    id INTEGER PRIMARY KEY, business_name TEXT, contact_person TEXT, email TEXT,
    stage TEXT DEFAULT 'new', replied_at TEXT, draft_email TEXT,
    email_status TEXT, email_queued_at TEXT, email_sent_at_q TEXT, email_error TEXT,
    do_not_email INTEGER NOT NULL DEFAULT 0, sequence_enrolled_at TEXT, updated_at TEXT
  )`);
  db.exec(`CREATE TABLE outreach_touches (id INTEGER PRIMARY KEY, lead_id INTEGER, channel TEXT, sent_at TEXT DEFAULT (datetime('now')), note TEXT, created_at TEXT DEFAULT (datetime('now')))`);
  db.exec(`CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)`);
  db.exec(`CREATE TABLE sequence_sends (
    id INTEGER PRIMARY KEY AUTOINCREMENT, lead_id INTEGER NOT NULL, step INTEGER NOT NULL,
    ok INTEGER NOT NULL DEFAULT 1, error TEXT, sent_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(lead_id, step, ok)
  )`);
  const ins = db.prepare("INSERT INTO leads (business_name,email,draft_email,email_status,email_queued_at) VALUES (?,?,?,?,datetime('now'))");
  ins.run('A', 'a@x.com', 'Subject: hi A\n\nbody A', 'queued');
  ins.run('B', 'b@x.com', 'Subject: hi B\n\nbody B', 'queued');
  return db;
}
const fakeNow = new Date('2026-06-29T14:00:00-05:00'); // a Monday, 2pm Central

describe('sendOneTick', () => {
  let db: Database.Database;
  let sent: Array<{ from: string; to: string; subject: string; text: string }>;
  const transport: Transport = { sendMail: async (m) => { sent.push(m); return { messageId: 'x' }; } };
  beforeEach(() => { db = freshDb(); sent = []; });

  it('sends exactly one queued email and marks it sent + logs a touch', async () => {
    const r = await sendOneTick(db, { transport, now: fakeNow, from: 'phil@rekindleleads.com' });
    expect(r.sent).toBe(true);
    expect(sent.length).toBe(1);
    expect(sent[0].to).toBe('a@x.com');
    expect(sent[0].subject).toBe('hi A');
    const row = db.prepare("SELECT email_status FROM leads WHERE id=1").get() as { email_status: string };
    expect(row.email_status).toBe('sent');
    expect((db.prepare("SELECT COUNT(*) n FROM outreach_touches WHERE lead_id=1 AND channel='email'").get() as { n: number }).n).toBe(1);
  });

  it('does nothing outside business hours', async () => {
    const evening = new Date('2026-06-29T21:00:00-05:00');
    const r = await sendOneTick(db, { transport, now: evening, from: 'p@r.com' });
    expect(r.sent).toBe(false); expect(r.reason).toBe('outside-hours'); expect(sent.length).toBe(0);
  });

  it('does nothing on weekends', async () => {
    const sun = new Date('2026-06-28T14:00:00-05:00');
    const r = await sendOneTick(db, { transport, now: sun, from: 'p@r.com' });
    expect(r.sent).toBe(false); expect(r.reason).toBe('weekend');
  });

  it('stops once the daily target is reached', async () => {
    for (let i = 0; i < 28; i++) { db.prepare("INSERT INTO leads (email,email_status,email_sent_at_q) VALUES ('z@x.com','sent',datetime('now','localtime'))").run(); }
    const r = await sendOneTick(db, { transport, now: fakeNow, from: 'p@r.com' });
    expect(r.sent).toBe(false); expect(r.reason).toBe('daily-cap'); expect(sent.length).toBe(0);
  });

  it('records failure without crashing', async () => {
    const boom: Transport = { sendMail: async () => { throw new Error('smtp down'); } };
    const r = await sendOneTick(db, { transport: boom, now: fakeNow, from: 'p@r.com' });
    expect(r.sent).toBe(false); expect(r.reason).toBe('error');
    expect((db.prepare("SELECT email_status FROM leads WHERE id=1").get() as { email_status: string }).email_status).toBe('failed');
  });
});

describe('sendOneTick sequence leg', () => {
  let db: Database.Database;
  let sent: Array<{ from: string; to: string; subject: string; text: string }>;
  const transport: Transport = { sendMail: async (m) => { sent.push(m); return { messageId: 'x' }; } };
  beforeEach(() => {
    db = freshDb(); sent = [];
    // drain the single-draft queue so the sequence leg runs
    db.prepare("UPDATE leads SET email_status='skipped'").run();
    db.prepare(`INSERT INTO leads (business_name, contact_person, email, sequence_enrolled_at)
      VALUES ('Acme HVAC', 'Brett Boston', 'brett@acme.com', datetime('now'))`).run();
  });

  it('sends step 1 to an enrolled lead when the queue is empty, logs touch + advances stage', async () => {
    const r = await sendOneTick(db, { transport, now: fakeNow, from: 'p@r.com' });
    expect(r.sent).toBe(true);
    expect(sent[0].to).toBe('brett@acme.com');
    expect(sent[0].subject).toBe('the honest version of an AI pitch');
    expect(sent[0].text.startsWith('Brett,')).toBe(true);
    expect(sent[0].text).toContain('for Acme HVAC?');
    const lead = db.prepare("SELECT stage FROM leads WHERE email='brett@acme.com'").get() as { stage: string };
    expect(lead.stage).toBe('contacted');
    const touch = db.prepare("SELECT note FROM outreach_touches ORDER BY id DESC LIMIT 1").get() as { note: string };
    expect(touch.note).toBe('sequence step 1 auto-sent');
    // step 2 not due yet
    const r2 = await sendOneTick(db, { transport, now: fakeNow, from: 'p@r.com' });
    expect(r2.sent).toBe(false); expect(r2.reason).toBe('empty');
  });

  it('backlogged lead: follow-up steps anchor to the first SEND, not enrollment', async () => {
    // Enrolled 5 days ago, but never reached the front of the cap backlog.
    db.prepare(`UPDATE leads SET sequence_enrolled_at = datetime('now', '-5 days')
      WHERE email='brett@acme.com'`).run();
    // Step 1 goes out today (its dayOffset-0 has long passed).
    const r1 = await sendOneTick(db, { transport, now: fakeNow, from: 'p@r.com' });
    expect(r1.sent).toBe(true);
    // Step 2's dayOffset (3 days) is past relative to ENROLLMENT, but not
    // relative to the step-1 send — it must NOT fire back-to-back today.
    const r2 = await sendOneTick(db, { transport, now: fakeNow, from: 'p@r.com' });
    expect(r2.sent).toBe(false); expect(r2.reason).toBe('empty');
    // Once the first send is 3+ days old, step 2 becomes due.
    db.prepare(`UPDATE sequence_sends SET sent_at = datetime('now', '-3 days')
      WHERE lead_id = (SELECT id FROM leads WHERE email='brett@acme.com')`).run();
    const r3 = await sendOneTick(db, { transport, now: fakeNow, from: 'p@r.com' });
    expect(r3.sent).toBe(true);
    expect(sent[1].to).toBe('brett@acme.com');
  });

  it('queued single drafts always go before sequence sends', async () => {
    db.prepare("UPDATE leads SET email_status='queued', email_queued_at=datetime('now') WHERE id=1").run();
    const r = await sendOneTick(db, { transport, now: fakeNow, from: 'p@r.com' });
    expect(r.sent).toBe(true);
    expect(sent[0].to).toBe('a@x.com');
  });

  it('sequence sends count toward the shared daily cap', async () => {
    for (let i = 0; i < 28; i++) db.prepare("INSERT INTO sequence_sends (lead_id, step) VALUES (99, ?)").run(i + 1);
    const r = await sendOneTick(db, { transport, now: fakeNow, from: 'p@r.com' });
    expect(r.sent).toBe(false); expect(r.reason).toBe('daily-cap');
  });

  it('a sequence failure parks the lead (no retry loop)', async () => {
    const boom: Transport = { sendMail: async () => { throw new Error('gmail down'); } };
    const r = await sendOneTick(db, { transport: boom, now: fakeNow, from: 'p@r.com' });
    expect(r.sent).toBe(false); expect(r.reason).toBe('error');
    const r2 = await sendOneTick(db, { transport: boom, now: fakeNow, from: 'p@r.com' });
    expect(r2.sent).toBe(false); expect(r2.reason).toBe('empty');
    const fail = db.prepare('SELECT ok, error FROM sequence_sends').get() as { ok: number; error: string };
    expect(fail.ok).toBe(0); expect(fail.error).toContain('gmail down');
  });
});
