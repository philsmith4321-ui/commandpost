// One-off: email ALL remaining eligible handwritten-letter drafts to Phil in
// chunks (default 20 per email), drafting any missing letters first. Reuses
// the letter-batch pipeline pieces so drafts/envelopes match the daily batch.
//
// Run from the app root so getDb() finds data/commandpost.db:
//   npx --yes tsx --env-file=.env scripts/send-remaining-letters.ts
// Marks each emailed lead letter_status='sent' (touch note "emailed to Phil"),
// same bookkeeping as a Caroline batch, so nothing gets double-assigned.

import { getDb } from '@/lib/db';
import { buildTransport } from '@/lib/email/outreach-sender';
import { generateDraft, MAILING_ADDRESS } from '@/lib/outreach/draft';
import type { OutreachLead } from '@/lib/queries/outreach-lead-queries';
import {
  eligibleLetterLeads, saveLetterDraft, type LetterLead,
} from '@/lib/queries/letter-batch-queries';
import { recipientName, formatEnvelope, centralDateParts } from '@/lib/outreach/letter-batch';

const TO = 'phil@rekindleleads.com';
const CHUNK = 20;
const DIVIDER = '='.repeat(50);

function composeEmail(leads: LetterLead[], batchNum: number, batchTotal: number): { subject: string; text: string } {
  const n = leads.length;
  const subject = `Handwritten letter drafts — batch ${batchNum} of ${batchTotal} (${n} ${n === 1 ? 'company' : 'companies'})`;
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
    'Hi Phil!',
    '',
    `Batch ${batchNum} of ${batchTotal}: ${n} handwritten letter draft${n === 1 ? '' : 's'}. For each company below you'll find who it goes to, the envelope address, and the letter text.`,
    '',
    'Return address for every envelope:',
    'Phil Smith',
    MAILING_ADDRESS,
    '',
    ...sections,
    '— CommandPost',
    '',
  ].join('\n');
  return { subject, text };
}

async function main() {
  const db = getDb();
  const from = process.env.OUTREACH_SMTP_FROM || process.env.OUTREACH_SMTP_USER;
  if (!from) throw new Error('OUTREACH_SMTP_FROM not set');
  const transport = buildTransport();
  const { isoDate } = centralDateParts(new Date());

  // Snapshot the whole pool up front (same order as the daily batch) so a
  // draft failure can't make the loop re-pull and retry forever.
  const pool = eligibleLetterLeads(db, 10_000);
  const batchTotal = Math.ceil(pool.length / CHUNK);
  console.log(`${pool.length} eligible leads -> ${batchTotal} emails of up to ${CHUNK}`);

  const stamp = db.prepare(`UPDATE leads SET letter_status='sent', letter_sent_at_q=datetime('now'),
    letter_batch_date=?, updated_at=datetime('now') WHERE id=?`);
  const touch = db.prepare(
    "INSERT INTO outreach_touches (lead_id, channel, note) VALUES (?, 'letter', 'emailed to Phil')"
  );

  let sentLeads = 0;
  const failedDrafts: number[] = [];

  for (let b = 0; b < batchTotal; b++) {
    const chunk = pool.slice(b * CHUNK, (b + 1) * CHUNK);
    const ready: LetterLead[] = [];
    for (const lead of chunk) {
      if (lead.draft_letter?.trim()) { ready.push(lead); continue; }
      let text: string | null = null;
      try { text = await generateDraft(db, lead as unknown as OutreachLead, 'letter'); } catch { /* retry below */ }
      if (!text?.trim()) {
        try { text = await generateDraft(db, lead as unknown as OutreachLead, 'letter'); } catch { text = null; }
      }
      if (text?.trim()) {
        saveLetterDraft(db, lead.id, text.trim());
        ready.push({ ...lead, draft_letter: text.trim() });
        console.log(`  drafted #${lead.id} ${lead.business_name}`);
      } else {
        failedDrafts.push(lead.id);
        console.log(`  DRAFT FAILED #${lead.id} ${lead.business_name} (left in pool)`);
      }
    }
    if (ready.length === 0) { console.log(`batch ${b + 1}: nothing ready, skipping`); continue; }

    const { subject, text } = composeEmail(ready, b + 1, batchTotal);
    await transport.sendMail({ from, to: TO, subject, text });
    db.transaction(() => {
      for (const lead of ready) { stamp.run(isoDate, lead.id); touch.run(lead.id); }
    })();
    sentLeads += ready.length;
    console.log(`batch ${b + 1}/${batchTotal} SENT (${ready.length} letters) -> ${TO}`);
  }

  console.log(`DONE: ${sentLeads} letters emailed in ${batchTotal} batches; ${failedDrafts.length} draft failures ${failedDrafts.length ? `(ids: ${failedDrafts.join(', ')})` : ''}`);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
