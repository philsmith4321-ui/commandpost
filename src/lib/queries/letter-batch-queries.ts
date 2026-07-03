import type Database from 'better-sqlite3';

// Everything the letter batch needs per lead: envelope address fields plus the
// personalization fields generateDraft reads (lane, segment, size, website).
export interface LetterLead {
  id: number; business_name: string | null; contact_person: string | null;
  street: string | null; city: string | null; state: string | null; postal_code: string | null;
  draft_letter: string | null; email_queued_at: string | null;
  lane: string | null; segment: string | null; category: string | null;
  employee_min: number | null; employee_max: number | null; website: string | null;
}

const SELECT = `SELECT id, business_name, contact_person, street, city, state, postal_code,
  draft_letter, email_queued_at, lane, segment, category, employee_min, employee_max, website FROM leads`;

// A lead earns a handwritten letter once it has entered the email pipeline —
// the single-draft queue (queued now OR already auto-emailed; leads keep their
// spot after the email sends) OR the 5-email drip sequence, which is where
// bulk launches actually live — and has a business name plus a complete
// mailing address. Oldest pipeline entry goes first.
export function eligibleLetterLeads(db: Database.Database, limit: number): LetterLead[] {
  return db.prepare(`${SELECT}
    WHERE ((email_status IN ('queued','sent') AND email_queued_at IS NOT NULL)
        OR sequence_enrolled_at IS NOT NULL)
      AND letter_status IS NULL
      AND COALESCE(do_not_email, 0) = 0
      AND business_name IS NOT NULL AND trim(business_name) <> ''
      AND street IS NOT NULL AND trim(street) <> ''
      AND city IS NOT NULL AND trim(city) <> ''
      AND state IS NOT NULL AND trim(state) <> ''
      AND postal_code IS NOT NULL AND trim(postal_code) <> ''
    ORDER BY COALESCE(email_queued_at, sequence_enrolled_at), id LIMIT ?`).all(limit) as LetterLead[];
}

export function saveLetterDraft(db: Database.Database, id: number, text: string): void {
  db.prepare(`UPDATE leads SET draft_letter=?, updated_at=datetime('now') WHERE id=?`).run(text, id);
}

// Stamp every lead in a shipped batch and log a letter touch each, atomically.
export function markLetterBatchSent(db: Database.Database, ids: number[], batchDate: string): void {
  const stamp = db.prepare(`UPDATE leads SET letter_status='sent', letter_sent_at_q=datetime('now'),
    letter_batch_date=?, updated_at=datetime('now') WHERE id=?`);
  const touch = db.prepare(
    "INSERT INTO outreach_touches (lead_id, channel, note) VALUES (?, 'letter', 'batched to Caroline')"
  );
  db.transaction(() => {
    for (const id of ids) { stamp.run(batchDate, id); touch.run(id); }
  })();
}
