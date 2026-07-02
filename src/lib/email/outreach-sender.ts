import { readFileSync } from 'fs';
import type Database from 'better-sqlite3';
import { JWT } from 'google-auth-library';
import { parseEmail, dailyTarget } from '@/lib/outreach/email-queue';
import { nextSendable, sentTodayCount, markSent, markFailed } from '@/lib/queries/outreach-email-queue-queries';
import { getEmailSequence, renderSequenceEmail } from '@/lib/outreach/sequence';
import {
  nextDueSequenceSend, recordSequenceSend, recordSequenceFailure, sequenceSentTodayCount,
} from '@/lib/queries/sequence-queries';

export interface Transport { sendMail(mail: { from: string; to: string; subject: string; text: string }): Promise<unknown>; }

const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';

// Encode a plain-text message as a Gmail API base64url RFC822 payload.
function toRaw(mail: { from: string; to: string; subject: string; text: string }): string {
  const mime =
    `From: ${mail.from}\r\nTo: ${mail.to}\r\n` +
    `Subject: ${mail.subject}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${mail.text}`;
  return Buffer.from(mime).toString('base64url');
}

// Gmail API transport over HTTPS (DigitalOcean blocks SMTP ports). A service
// account with domain-wide delegation impersonates the sending mailbox; creds
// come from server .env (JSON key path + the mailbox to send as).
export function buildTransport(): Transport {
  const saPath = process.env.OUTREACH_GMAIL_SA_PATH;
  const sender = process.env.OUTREACH_GMAIL_SENDER || process.env.OUTREACH_SMTP_USER;
  if (!saPath || !sender) throw new Error('Gmail sender not configured (OUTREACH_GMAIL_SA_PATH / OUTREACH_GMAIL_SENDER)');
  const key = JSON.parse(readFileSync(saPath, 'utf8')) as { client_email: string; private_key: string };
  const client = new JWT({ email: key.client_email, key: key.private_key, scopes: [GMAIL_SEND_SCOPE], subject: sender });
  return {
    async sendMail(mail) {
      const { token } = await client.getAccessToken();
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: toRaw(mail) }),
      });
      if (!res.ok) throw new Error(`gmail-api ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return res.json();
    },
  };
}

const TZ = 'America/Chicago';
function centralParts(now: Date): { dow: number; hour: number; isoDate: string } {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', hour: 'numeric', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit' });
  const p = Object.fromEntries(fmt.formatToParts(now).map((x) => [x.type, x.value])) as Record<string, string>;
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { dow: dowMap[p.weekday], hour: parseInt(p.hour, 10) % 24, isoDate: `${p.year}-${p.month}-${p.day}` };
}

export interface TickOpts { transport: Transport; now: Date; from: string; }
export interface TickResult { sent: boolean; reason?: 'weekend' | 'outside-hours' | 'daily-cap' | 'empty' | 'error'; leadId?: number; }

// One send attempt: honor weekday/business-hours/daily-cap, then send the oldest
// sendable queued email. Designed to be called repeatedly by a cron tick.
export async function sendOneTick(db: Database.Database, opts: TickOpts): Promise<TickResult> {
  const { dow, hour, isoDate } = centralParts(opts.now);
  if (dow === 0 || dow === 6) return { sent: false, reason: 'weekend' };
  if (hour < 9 || hour >= 17) return { sent: false, reason: 'outside-hours' };
  // Single-draft queue and drip sequence share one daily cap.
  if (sentTodayCount(db) + sequenceSentTodayCount(db) >= dailyTarget(isoDate))
    return { sent: false, reason: 'daily-cap' };

  const lead = nextSendable(db);
  if (!lead) return sendOneSequenceTick(db, opts);
  const { subject, body } = parseEmail(lead.draft_email || '');
  try {
    await opts.transport.sendMail({ from: opts.from, to: lead.email as string, subject, text: body });
    markSent(db, lead.id);
    db.prepare("INSERT INTO outreach_touches (lead_id, channel, note) VALUES (?, 'email', 'auto-sent')").run(lead.id);
    db.prepare("UPDATE leads SET stage='contacted' WHERE id=? AND stage='new'").run(lead.id);
    return { sent: true, leadId: lead.id };
  } catch (e) {
    markFailed(db, lead.id, e instanceof Error ? e.message : String(e));
    return { sent: false, reason: 'error', leadId: lead.id };
  }
}

// Drip-sequence leg of the tick: runs only when the single-draft queue is empty,
// so hand-reviewed emails always go first. Sends the oldest-enrolled lead's due
// step; a failure is logged to sequence_sends (ok=0) which parks that lead until
// the operator retries, so one bad address can't wedge the whole sequence.
async function sendOneSequenceTick(db: Database.Database, opts: TickOpts): Promise<TickResult> {
  const steps = getEmailSequence(db);
  const due = nextDueSequenceSend(db, steps);
  if (!due) return { sent: false, reason: 'empty' };
  const { lead, step } = due;
  const { subject, body } = renderSequenceEmail(step, lead);
  try {
    await opts.transport.sendMail({ from: opts.from, to: lead.email as string, subject, text: body });
    recordSequenceSend(db, lead.id, step.step);
    db.prepare("INSERT INTO outreach_touches (lead_id, channel, note) VALUES (?, 'email', ?)")
      .run(lead.id, `sequence step ${step.step} auto-sent`);
    db.prepare("UPDATE leads SET stage='contacted' WHERE id=? AND stage='new'").run(lead.id);
    return { sent: true, leadId: lead.id };
  } catch (e) {
    recordSequenceFailure(db, lead.id, step.step, e instanceof Error ? e.message : String(e));
    return { sent: false, reason: 'error', leadId: lead.id };
  }
}
