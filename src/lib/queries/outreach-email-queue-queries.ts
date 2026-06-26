import type Database from 'better-sqlite3';
import { EMAIL_STATUS, isSendable, type SendableLead } from '@/lib/outreach/email-queue';

export type Tab = 'review' | 'queued' | 'sent';

export interface QueueLead {
  id: number; business_name: string | null; contact_person: string | null;
  email: string | null; draft_email: string | null; email_status: string | null;
  email_queued_at: string | null; email_sent_at_q: string | null; email_error: string | null;
  do_not_email: number | null; replied_at: string | null;
}

const SELECT = `SELECT id, business_name, contact_person, email, draft_email, email_status,
  email_queued_at, email_sent_at_q, email_error, do_not_email, replied_at FROM leads`;

export function listByTab(db: Database.Database, tab: Tab): QueueLead[] {
  if (tab === 'review')
    return db.prepare(`${SELECT} WHERE email_status = ? ORDER BY id`).all(EMAIL_STATUS.DRAFT) as QueueLead[];
  if (tab === 'queued')
    return db.prepare(`${SELECT} WHERE email_status = ? ORDER BY email_queued_at, id`).all(EMAIL_STATUS.QUEUED) as QueueLead[];
  return db.prepare(`${SELECT} WHERE email_status IN (?, ?) ORDER BY email_sent_at_q DESC, id`)
    .all(EMAIL_STATUS.SENT, EMAIL_STATUS.FAILED) as QueueLead[];
}

function setStatus(db: Database.Database, id: number, status: string) {
  db.prepare(`UPDATE leads SET email_status=?, updated_at=datetime('now') WHERE id=?`).run(status, id);
}

export function approve(db: Database.Database, id: number) {
  db.prepare(`UPDATE leads SET email_status=?, email_queued_at=datetime('now'), email_error=NULL, updated_at=datetime('now')
    WHERE id=? AND email IS NOT NULL AND trim(email) <> ''`).run(EMAIL_STATUS.QUEUED, id);
}
export function skip(db: Database.Database, id: number) { setStatus(db, id, EMAIL_STATUS.SKIPPED); }
export function unqueue(db: Database.Database, id: number) {
  db.prepare(`UPDATE leads SET email_status=?, email_queued_at=NULL, updated_at=datetime('now') WHERE id=?`)
    .run(EMAIL_STATUS.DRAFT, id);
}
export function retry(db: Database.Database, id: number) {
  db.prepare(`UPDATE leads SET email_status=?, email_error=NULL, email_queued_at=datetime('now'), updated_at=datetime('now') WHERE id=?`)
    .run(EMAIL_STATUS.QUEUED, id);
}
export function editDraft(db: Database.Database, id: number, body: string) {
  db.prepare(`UPDATE leads SET draft_email=?, updated_at=datetime('now') WHERE id=?`).run(body, id);
}
export function setDoNotEmail(db: Database.Database, id: number, on: boolean) {
  db.prepare(`UPDATE leads SET do_not_email=?, updated_at=datetime('now') WHERE id=?`).run(on ? 1 : 0, id);
}

export function sentTodayCount(db: Database.Database): number {
  return (db.prepare(
    `SELECT COUNT(*) n FROM leads WHERE email_status=? AND date(email_sent_at_q)=date('now','localtime')`
  ).get(EMAIL_STATUS.SENT) as { n: number }).n;
}

// Oldest queued lead that passes every send guard, or null.
export function nextSendable(db: Database.Database): QueueLead | null {
  const rows = db.prepare(`${SELECT} WHERE email_status=? ORDER BY email_queued_at, id`).all(EMAIL_STATUS.QUEUED) as QueueLead[];
  return rows.find((r) => isSendable(r as unknown as SendableLead)) ?? null;
}

export function markSent(db: Database.Database, id: number) {
  db.prepare(`UPDATE leads SET email_status=?, email_sent_at_q=datetime('now'), email_error=NULL, updated_at=datetime('now') WHERE id=?`)
    .run(EMAIL_STATUS.SENT, id);
}
export function markFailed(db: Database.Database, id: number, err: string) {
  db.prepare(`UPDATE leads SET email_status=?, email_error=?, updated_at=datetime('now') WHERE id=?`)
    .run(EMAIL_STATUS.FAILED, err.slice(0, 500), id);
}
