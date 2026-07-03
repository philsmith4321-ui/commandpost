import type { LetterLead } from '@/lib/queries/letter-batch-queries';
import { MAILING_ADDRESS } from '@/lib/outreach/draft';

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
