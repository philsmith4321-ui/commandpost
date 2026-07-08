// One-off (2026-07-08): batch 3 of 7 from the July 6 all-remaining-letters email
// was never physically mailed, so regenerate those 20 letters with the current
// pipeline (prospect research + tightened 5x7-card length budget) and re-email
// them to Phil. Overwrites each lead's draft_letter; letter_status stays 'sent'.
//
// Run from the app root so getDb() finds data/commandpost.db:
//   npx --yes tsx --env-file=.env scripts/resend-letter-batch3.ts

import { getDb } from '@/lib/db';
import { buildTransport } from '@/lib/email/outreach-sender';
import { generateDraft, MAILING_ADDRESS } from '@/lib/outreach/draft';
import { ensureFreshResearch } from '@/lib/outreach/research';
import type { OutreachLead } from '@/lib/queries/outreach-lead-queries';
import { saveLetterDraft, type LetterLead } from '@/lib/queries/letter-batch-queries';
import { recipientName, formatEnvelope } from '@/lib/outreach/letter-batch';

const TO = 'phil@rekindleleads.com';
// Batch 3's leads, in the same order as the July 6 email.
const BATCH3_IDS = [52, 54, 55, 56, 59, 61, 62, 63, 85, 91, 246, 251, 253, 257, 258, 259, 260, 271, 272, 274];
// Body target is 100-125 words; signature adds ~4. Above this, retry the draft.
const MAX_WORDS = 134;
const DIVIDER = '='.repeat(50);

const wordCount = (t: string) => t.trim().split(/\s+/).length;

function composeEmail(leads: LetterLead[]): { subject: string; text: string } {
  const n = leads.length;
  const subject = `Handwritten letter drafts — batch 3 of 7 REVISED (${n} companies)`;
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
    `Revised batch 3 of 7: the same ${n} companies from the July 6 email, redrafted with per-company research woven in and shortened to fit a 5x7 card. These replace the July 6 versions.`,
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

  const pick = db.prepare('SELECT * FROM leads WHERE id = ?');
  const ready: LetterLead[] = [];
  const failed: number[] = [];

  for (const id of BATCH3_IDS) {
    const lead = pick.get(id) as LetterLead | undefined;
    if (!lead) { failed.push(id); console.log(`  #${id} NOT FOUND`); continue; }

    let toDraft = lead;
    try {
      const notes = await ensureFreshResearch(db, lead);
      if (notes) toDraft = { ...lead, research_notes: notes };
      console.log(`  #${id} ${lead.business_name}: research ${notes ? 'ok' : 'none'}`);
    } catch { /* fail-open: draft without research */ }

    let text: string | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      let candidate: string | null = null;
      try { candidate = await generateDraft(db, toDraft as unknown as OutreachLead, 'letter'); } catch { candidate = null; }
      if (!candidate?.trim()) continue;
      if (!text || wordCount(candidate) < wordCount(text)) text = candidate.trim();
      if (wordCount(text) <= MAX_WORDS) break;
      console.log(`  #${id} draft ran long (${wordCount(text)} words), retrying`);
    }
    if (text?.trim()) {
      saveLetterDraft(db, lead.id, text.trim());
      ready.push({ ...lead, draft_letter: text.trim() });
      console.log(`  #${id} redrafted (${wordCount(text)} words)`);
    } else {
      failed.push(id);
      console.log(`  #${id} DRAFT FAILED (old draft left in place)`);
    }
  }

  if (ready.length === 0) throw new Error('nothing redrafted, not sending');

  const { subject, text } = composeEmail(ready);
  await transport.sendMail({ from, to: TO, subject, text });
  const touch = db.prepare(
    "INSERT INTO outreach_touches (lead_id, channel, note) VALUES (?, 'letter', 'batch 3 revised (research + 5x7 length) re-emailed to Phil')"
  );
  db.transaction(() => { for (const l of ready) touch.run(l.id); })();

  console.log(`DONE: ${ready.length} revised letters emailed to ${TO}${failed.length ? `; FAILED ids: ${failed.join(', ')}` : ''}`);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
