import type Database from 'better-sqlite3';
import nodemailer from 'nodemailer';
import { parseEmail, dailyTarget } from '@/lib/outreach/email-queue';
import { nextSendable, sentTodayCount, markSent, markFailed } from '@/lib/queries/outreach-email-queue-queries';

export interface Transport { sendMail(mail: { from: string; to: string; subject: string; text: string }): Promise<unknown>; }

// Gmail SMTP via App Password. Creds from server .env (runtime).
export function buildTransport(): Transport {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: process.env.OUTREACH_SMTP_USER || '', pass: process.env.OUTREACH_SMTP_PASS || '' },
  }) as unknown as Transport;
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
  if (sentTodayCount(db) >= dailyTarget(isoDate)) return { sent: false, reason: 'daily-cap' };

  const lead = nextSendable(db);
  if (!lead) return { sent: false, reason: 'empty' };
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
