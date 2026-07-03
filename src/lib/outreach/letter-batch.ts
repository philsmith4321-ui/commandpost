import type Database from 'better-sqlite3';
import type { OutreachLead } from '@/lib/queries/outreach-lead-queries';
import type { Transport } from '@/lib/email/outreach-sender';
import { generateDraft, MAILING_ADDRESS } from '@/lib/outreach/draft';
import { getSetting, setSetting } from '@/lib/queries/settings-queries';
import {
  eligibleLetterLeads, saveLetterDraft, markLetterBatchSent, type LetterLead,
} from '@/lib/queries/letter-batch-queries';

export const LETTER_BATCH_SIZE = 10;
export const LETTER_BATCH_ENABLED_KEY = 'letter_batch_enabled';
export const LETTER_BATCH_RECIPIENT_KEY = 'letter_batch_recipient';
export const LETTER_LAST_BATCH_DATE_KEY = 'letter_last_batch_date';
export const DEFAULT_LETTER_RECIPIENT = 'thecarolinem@icloud.com';

// Envelope recipient: the contact person when we have one, else the business.
// Eligibility guarantees business_name is non-empty.
export function recipientName(lead: LetterLead): string {
  return lead.contact_person?.trim() || (lead.business_name ?? '').trim();
}

export function formatEnvelope(lead: LetterLead): string {
  const name = recipientName(lead);
  const business = (lead.business_name ?? '').trim();
  const lines = [name];
  if (business && business !== name) lines.push(business);
  lines.push((lead.street ?? '').trim());
  lines.push(`${(lead.city ?? '').trim()}, ${(lead.state ?? '').trim()} ${(lead.postal_code ?? '').trim()}`);
  return lines.join('\n');
}

const TZ = 'America/Chicago';

// Central-time calendar date for "one batch per day" bookkeeping (isoDate,
// YYYY-MM-DD via en-CA) plus a human label ("July 3") for the subject line.
export function centralDateParts(now: Date): { isoDate: string; label: string } {
  const isoDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  const label = new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'long', day: 'numeric' }).format(now);
  return { isoDate, label };
}

const DIVIDER = '='.repeat(50);

export function composeLetterBatchEmail(
  leads: LetterLead[], dateLabel: string
): { subject: string; text: string } {
  const n = leads.length;
  const subject = `Handwritten letters — ${dateLabel} (${n} ${n === 1 ? 'company' : 'companies'})`;
  const sections = leads.map((lead, i) => [
    DIVIDER,
    `LETTER ${i + 1} of ${n} — ${(lead.business_name ?? '').trim()}`,
    DIVIDER,
    '',
    `WRITE TO: ${recipientName(lead)}`,
    '',
    'ENVELOPE ADDRESS:',
    formatEnvelope(lead),
    '',
    'LETTER TEXT:',
    (lead.draft_letter ?? '').trim(),
    '',
  ].join('\n'));
  const text = [
    'Hi Caroline!',
    '',
    `Here ${n === 1 ? 'is' : 'are'} today's ${n} handwritten letter${n === 1 ? '' : 's'}. For each company below you'll find who it goes to, the envelope address, and the letter text to copy by hand.`,
    '',
    'Return address for every envelope:',
    'Phil Smith',
    MAILING_ADDRESS,
    '',
    ...sections,
    'Thank you! — CommandPost (for Dad)',
    '',
  ].join('\n');
  return { subject, text };
}

export interface LetterTickOpts {
  transport: Transport;
  now: Date;
  from: string;
  // dryRun sends the composed batch (to `to` or the configured recipient)
  // without marking any lead or the daily guard — the format-test path.
  dryRun?: boolean;
  to?: string;
  // Test seam; production uses generateDraft. LetterLead carries every field
  // generateDraft actually reads, so the cast below is safe at runtime.
  draftFn?: (db: Database.Database, lead: LetterLead, channel: 'letter') => Promise<string | null>;
}

export interface LetterTickResult {
  sent: number;
  skippedDrafts: number;
  recipient: string | null;
  dryRun: boolean;
  leadIds: number[];
  reason?: 'disabled' | 'already-sent-today' | 'empty' | 'error';
  error?: string;
}

// One daily batch: pull up to 10 eligible leads, draft any missing letters,
// email the assignment sheet, and (real runs only) mark everything included.
export async function runLetterBatchTick(
  db: Database.Database, opts: LetterTickOpts
): Promise<LetterTickResult> {
  const dryRun = !!opts.dryRun;
  const { isoDate, label } = centralDateParts(opts.now);
  const none = (reason: LetterTickResult['reason']): LetterTickResult =>
    ({ sent: 0, skippedDrafts: 0, recipient: null, dryRun, leadIds: [], reason });

  if (!dryRun) {
    if (getSetting(db, LETTER_BATCH_ENABLED_KEY) !== '1') return none('disabled');
    if (getSetting(db, LETTER_LAST_BATCH_DATE_KEY) === isoDate) return none('already-sent-today');
  }

  const candidates = eligibleLetterLeads(db, LETTER_BATCH_SIZE);
  if (candidates.length === 0) return none('empty');

  const draft = opts.draftFn
    ?? ((d: Database.Database, l: LetterLead, channel: 'letter') =>
      generateDraft(d, l as unknown as OutreachLead, channel));

  // Draft any missing letters; a failed draft defers that lead to a later
  // batch (letter_status stays NULL) rather than wedging today's email.
  const ready: LetterLead[] = [];
  let skippedDrafts = 0;
  for (const candidate of candidates) {
    if (candidate.draft_letter?.trim()) { ready.push(candidate); continue; }
    let text: string | null = null;
    try { text = await draft(db, candidate, 'letter'); } catch { text = null; }
    if (text?.trim()) {
      saveLetterDraft(db, candidate.id, text.trim());
      ready.push({ ...candidate, draft_letter: text.trim() });
    } else {
      skippedDrafts++;
    }
  }
  if (ready.length === 0) return { ...none('empty'), skippedDrafts };

  const recipient = opts.to || getSetting(db, LETTER_BATCH_RECIPIENT_KEY) || DEFAULT_LETTER_RECIPIENT;
  const { subject, text } = composeLetterBatchEmail(ready, label);
  try {
    await opts.transport.sendMail({ from: opts.from, to: recipient, subject, text });
  } catch (e) {
    return {
      ...none('error'), skippedDrafts, recipient,
      error: (e instanceof Error ? e.message : String(e)).slice(0, 500),
    };
  }

  const leadIds = ready.map((l) => l.id);
  if (!dryRun) {
    markLetterBatchSent(db, leadIds, isoDate);
    setSetting(db, LETTER_LAST_BATCH_DATE_KEY, isoDate);
  }
  return { sent: ready.length, skippedDrafts, recipient, dryRun, leadIds };
}
