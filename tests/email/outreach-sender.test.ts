import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { sendOneTick, type Transport } from '@/lib/email/outreach-sender';

function freshDb() {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE leads (
    id INTEGER PRIMARY KEY, business_name TEXT, contact_person TEXT, email TEXT,
    stage TEXT DEFAULT 'new', replied_at TEXT, draft_email TEXT,
    email_status TEXT, email_queued_at TEXT, email_sent_at_q TEXT, email_error TEXT,
    do_not_email INTEGER NOT NULL DEFAULT 0, updated_at TEXT
  )`);
  db.exec(`CREATE TABLE outreach_touches (id INTEGER PRIMARY KEY, lead_id INTEGER, channel TEXT, sent_at TEXT DEFAULT (datetime('now')), note TEXT, created_at TEXT DEFAULT (datetime('now')))`);
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
    for (let i = 0; i < 15; i++) { db.prepare("INSERT INTO leads (email,email_status,email_sent_at_q) VALUES ('z@x.com','sent',datetime('now','localtime'))").run(); }
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
