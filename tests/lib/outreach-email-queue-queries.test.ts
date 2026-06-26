import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  listByTab, approve, skip, unqueue, retry, setDoNotEmail,
  sentTodayCount, nextSendable, markSent, markFailed,
} from '@/lib/queries/outreach-email-queue-queries';
import { EMAIL_STATUS } from '@/lib/outreach/email-queue';

function freshDb() {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE leads (
    id INTEGER PRIMARY KEY, business_name TEXT, contact_person TEXT, email TEXT,
    stage TEXT DEFAULT 'new', replied_at TEXT, draft_email TEXT,
    email_status TEXT, email_queued_at TEXT, email_sent_at_q TEXT, email_error TEXT,
    do_not_email INTEGER NOT NULL DEFAULT 0, updated_at TEXT
  )`);
  const ins = db.prepare("INSERT INTO leads (business_name,email,draft_email,email_status) VALUES (?,?,?,?)");
  ins.run('A', 'a@x.com', 'Subject: hi\n\nbody', 'draft');
  ins.run('B', 'b@x.com', 'Subject: hi\n\nbody', 'draft');
  return db;
}

describe('email queue queries', () => {
  let db: Database.Database;
  beforeEach(() => { db = freshDb(); });

  it('approve moves draft -> queued and stamps queued_at', () => {
    approve(db, 1);
    const row = db.prepare('SELECT email_status,email_queued_at FROM leads WHERE id=1').get() as { email_status: string; email_queued_at: string };
    expect(row.email_status).toBe(EMAIL_STATUS.QUEUED);
    expect(row.email_queued_at).toBeTruthy();
    expect(listByTab(db, 'queued').length).toBe(1);
    expect(listByTab(db, 'review').length).toBe(1);
  });

  it('skip / unqueue / retry transitions', () => {
    skip(db, 1);
    expect((db.prepare('SELECT email_status s FROM leads WHERE id=1').get() as { s: string }).s).toBe(EMAIL_STATUS.SKIPPED);
    approve(db, 2); unqueue(db, 2);
    expect((db.prepare('SELECT email_status s FROM leads WHERE id=2').get() as { s: string }).s).toBe(EMAIL_STATUS.DRAFT);
    markFailed(db, 2, 'smtp boom'); retry(db, 2);
    expect((db.prepare('SELECT email_status s FROM leads WHERE id=2').get() as { s: string }).s).toBe(EMAIL_STATUS.QUEUED);
  });

  it('nextSendable returns oldest queued, markSent finalizes, sentTodayCount counts today', () => {
    approve(db, 1); approve(db, 2);
    const n = nextSendable(db);
    expect(n!.id).toBe(1);
    markSent(db, 1);
    const row = db.prepare('SELECT email_status,email_sent_at_q FROM leads WHERE id=1').get() as { email_status: string; email_sent_at_q: string };
    expect(row.email_status).toBe(EMAIL_STATUS.SENT);
    expect(sentTodayCount(db)).toBe(1);
  });

  it('setDoNotEmail removes a lead from sendable', () => {
    approve(db, 1); setDoNotEmail(db, 1, true);
    expect(nextSendable(db)?.id).not.toBe(1);
  });
});
