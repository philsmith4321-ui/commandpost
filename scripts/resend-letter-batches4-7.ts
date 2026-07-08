// One-off (2026-07-08): re-send batches 4-7 from the July 6 all-remaining-letters
// email with the current pipeline (prospect research + 5x7-card length budget),
// same as the batch-3 resend. One email per batch. Overwrites draft_letter;
// letter_status stays 'sent'.
//
// Six batch-7 leads (churches/schools/nonprofits) were deleted from the DB after
// July 6 and are skipped; the batch-7 email calls that out.
//
// Run from the app root so getDb() finds data/commandpost.db:
//   npx --yes tsx --env-file=.env scripts/resend-letter-batches4-7.ts

import { getDb } from '@/lib/db';
import { buildTransport } from '@/lib/email/outreach-sender';
import { generateDraft, MAILING_ADDRESS } from '@/lib/outreach/draft';
import { ensureFreshResearch } from '@/lib/outreach/research';
import type { OutreachLead } from '@/lib/queries/outreach-lead-queries';
import { saveLetterDraft, type LetterLead } from '@/lib/queries/letter-batch-queries';
import { recipientName, formatEnvelope } from '@/lib/outreach/letter-batch';

const TO = 'phil@rekindleleads.com';
// Lead ids per July 6 batch, in the same order as those emails.
const BATCHES: Record<number, number[]> = {
  4: [277, 278, 279, 280, 283, 284, 286, 287, 290, 293, 295, 296, 297, 299, 305, 306, 308, 309, 312, 317],
  5: [321, 322, 323, 325, 327, 331, 334, 335, 336, 338, 339, 340, 341, 342, 343, 348, 352, 354, 355, 357],
  6: [359, 360, 362, 364, 365, 366, 367, 369, 371, 372, 374, 375, 377, 378, 379, 385, 387, 393, 394, 398],
  7: [413, 414, 416, 421, 422, 424, 427],
};
const BATCH7_NOTE =
  'NOTE: the July 6 batch 7 also had Hendersonville Christian Academy, CIL Church, Hendersonville Samaritan Association, Feed Sumner Food Bank & Ministry, Christian Community Schools, and Metro Christian Academy. Those six were since deleted from CommandPost, so no revised letters for them.';
// Body target is 100-125 words; signature adds ~4. Above this, retry the draft.
const MAX_WORDS = 134;
const DIVIDER = '='.repeat(50);

const wordCount = (t: string) => t.trim().split(/\s+/).length;

function composeEmail(leads: LetterLead[], batchNum: number): { subject: string; text: string } {
  const n = leads.length;
  const subject = `Handwritten letter drafts — batch ${batchNum} of 7 REVISED (${n} companies)`;
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
    `Revised batch ${batchNum} of 7: the same companies from the July 6 email, redrafted with per-company research woven in and shortened to fit a 5x7 card. These replace the July 6 versions.`,
    ...(batchNum === 7 ? ['', BATCH7_NOTE] : []),
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
  const touch = db.prepare(
    "INSERT INTO outreach_touches (lead_id, channel, note) VALUES (?, 'letter', ?)"
  );
  const allFailed: number[] = [];

  for (const [batchNumStr, ids] of Object.entries(BATCHES)) {
    const batchNum = Number(batchNumStr);
    const ready: LetterLead[] = [];
    for (const id of ids) {
      const lead = pick.get(id) as LetterLead | undefined;
      if (!lead) { allFailed.push(id); console.log(`  #${id} NOT FOUND`); continue; }

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
        allFailed.push(id);
        console.log(`  #${id} DRAFT FAILED (old draft left in place)`);
      }
    }
    if (ready.length === 0) { console.log(`batch ${batchNum}: nothing ready, SKIPPED`); continue; }

    const { subject, text } = composeEmail(ready, batchNum);
    await transport.sendMail({ from, to: TO, subject, text });
    db.transaction(() => {
      for (const l of ready) touch.run(l.id, `batch ${batchNum} revised (research + 5x7 length) re-emailed to Phil`);
    })();
    console.log(`batch ${batchNum} SENT (${ready.length} letters) -> ${TO}`);
  }

  console.log(`DONE${allFailed.length ? `; FAILED ids: ${allFailed.join(', ')}` : ''}`);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
