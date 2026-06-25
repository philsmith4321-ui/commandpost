import type Database from 'better-sqlite3';
import type { Lead, OutreachChannel } from '@/lib/types';
import { updateLeadStage, addLeadNote } from '@/lib/queries/lead-queries';

// A lead plus a derived summary of its outreach activity, for the Leads tab list.
export interface OutreachLead extends Lead {
  letter_sent_at: string | null;
  email_sent_at: string | null;
  touch_count: number;
}

export interface ListLeadsOptions {
  stage?: string;
  uncontactedOnly?: boolean;
}

export function listLeadsByLane(
  db: Database.Database,
  lane: string,
  opts: ListLeadsOptions = {}
): OutreachLead[] {
  const where: string[] = ['l.lane = @lane'];
  const params: Record<string, string> = { lane };
  if (opts.stage) {
    where.push('l.stage = @stage');
    params.stage = opts.stage;
  }
  if (opts.uncontactedOnly) {
    where.push("l.stage = 'new'");
  }
  return db
    .prepare(
      `SELECT l.*,
         (SELECT MAX(sent_at) FROM outreach_touches t WHERE t.lead_id = l.id AND t.channel = 'letter') AS letter_sent_at,
         (SELECT MAX(sent_at) FROM outreach_touches t WHERE t.lead_id = l.id AND t.channel = 'email')  AS email_sent_at,
         (SELECT COUNT(*)     FROM outreach_touches t WHERE t.lead_id = l.id)                          AS touch_count
       FROM leads l
       WHERE ${where.join(' AND ')}
       ORDER BY (l.stage = 'new') DESC, l.updated_at DESC`
    )
    .all(params) as OutreachLead[];
}

export function laneLeadCounts(db: Database.Database, lane: string): { total: number; uncontacted: number; replied: number } {
  const row = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN stage = 'new' THEN 1 ELSE 0 END) AS uncontacted,
         SUM(CASE WHEN replied_at IS NOT NULL THEN 1 ELSE 0 END) AS replied
       FROM leads WHERE lane = ?`
    )
    .get(lane) as { total: number; uncontacted: number | null; replied: number | null };
  return { total: row.total, uncontacted: row.uncontacted ?? 0, replied: row.replied ?? 0 };
}

// Log a letter/email/phone send. Advances a still-Sourced lead to Outreach Sent (contacted).
export function logTouch(
  db: Database.Database,
  leadId: number,
  channel: OutreachChannel,
  note?: string | null
): void {
  db.prepare('INSERT INTO outreach_touches (lead_id, channel, note) VALUES (?, ?, ?)').run(
    leadId,
    channel,
    note?.trim() ? note.trim() : null
  );
  const lead = db.prepare('SELECT stage FROM leads WHERE id = ?').get(leadId) as { stage: string } | undefined;
  if (lead?.stage === 'new') {
    updateLeadStage(db, leadId, 'contacted');
  } else {
    db.prepare("UPDATE leads SET updated_at = datetime('now') WHERE id = ?").run(leadId);
  }
}

export interface ContactPatch {
  email?: string | null;
  phone?: string | null;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
}

// Update a lead's contact / mailing-address fields (used by enrichment + manual edits).
export function updateLeadContact(db: Database.Database, leadId: number, patch: ContactPatch): void {
  const cols: (keyof ContactPatch)[] = ['email', 'phone', 'street', 'city', 'state', 'postal_code'];
  const sets: string[] = [];
  const params: Record<string, string | number | null> = { id: leadId };
  for (const c of cols) {
    if (c in patch) {
      sets.push(`${c} = @${c}`);
      const v = patch[c];
      params[c] = typeof v === 'string' && v.trim() ? v.trim() : null;
    }
  }
  if (sets.length === 0) return;
  db.prepare(`UPDATE leads SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = @id`).run(params);
}

export function markReplied(db: Database.Database, leadId: number): void {
  db.prepare("UPDATE leads SET replied_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(leadId);
}

export function setFollowUp(db: Database.Database, leadId: number, date: string | null): void {
  db.prepare("UPDATE leads SET follow_up_date = ?, updated_at = datetime('now') WHERE id = ?").run(
    date && date.trim() ? date.trim() : null,
    leadId
  );
}

export { addLeadNote };

// ---- CSV import -------------------------------------------------------------

export interface ImportLeadRow {
  business_name?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  website?: string;
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  socials?: string;
  notes?: string;
}

const trimOrNull = (v?: string): string | null => (v && v.trim() ? v.trim() : null);

// Insert mapped rows as leads for a lane. Dedupes on (business_name+street) or email.
export function importLeads(
  db: Database.Database,
  rows: ImportLeadRow[],
  lane: string
): { imported: number; skipped: number } {
  const insert = db.prepare(
    `INSERT INTO leads (business_name, contact_person, email, phone, website, street, city, state, postal_code, socials, source, stage, lane)
     VALUES (@business_name, @contact_person, @email, @phone, @website, @street, @city, @state, @postal_code, @socials, 'outbound', 'new', @lane)`
  );
  const dupByKey = db.prepare(
    "SELECT id FROM leads WHERE lower(business_name) = lower(@bn) AND lower(coalesce(street,'')) = lower(@st)"
  );
  const dupByEmail = db.prepare('SELECT id FROM leads WHERE email IS NOT NULL AND lower(email) = lower(@em)');

  let imported = 0;
  let skipped = 0;
  const run = db.transaction((items: ImportLeadRow[]) => {
    for (const r of items) {
      const business_name = trimOrNull(r.business_name);
      if (!business_name) {
        skipped++;
        continue;
      }
      const email = trimOrNull(r.email);
      const street = trimOrNull(r.street);
      const dup =
        (email && dupByEmail.get({ em: email })) ||
        dupByKey.get({ bn: business_name, st: street ?? '' });
      if (dup) {
        skipped++;
        continue;
      }
      const info = insert.run({
        business_name,
        contact_person: trimOrNull(r.contact_person),
        email,
        phone: trimOrNull(r.phone),
        website: trimOrNull(r.website),
        street,
        city: trimOrNull(r.city),
        state: trimOrNull(r.state),
        postal_code: trimOrNull(r.postal_code),
        socials: trimOrNull(r.socials),
        lane,
      });
      const id = Number(info.lastInsertRowid);
      db.prepare('INSERT INTO lead_stage_history (lead_id, stage) VALUES (?, ?)').run(id, 'new');
      const notes = trimOrNull(r.notes);
      if (notes) addLeadNote(db, id, notes);
      imported++;
    }
  });
  run(rows);
  return { imported, skipped };
}

// Map a raw CSV row (arbitrary headers) to ImportLeadRow via forgiving aliases.
const ALIASES: Record<keyof ImportLeadRow, string[]> = {
  business_name: ['business_name', 'business', 'company', 'company_name', 'name', 'business name', 'company name'],
  contact_person: ['contact_person', 'owner', 'owner_name', 'contact', 'contact_name', 'owner name', 'full_name', 'first_name'],
  email: ['email', 'email_address', 'e-mail', 'mail'],
  phone: ['phone', 'telephone', 'phone_number', 'tel', 'mobile'],
  website: ['website', 'url', 'site', 'web', 'domain'],
  street: ['street', 'address', 'address1', 'address_1', 'street_address', 'mailing_address'],
  city: ['city', 'town'],
  state: ['state', 'region', 'province'],
  postal_code: ['postal_code', 'zip', 'zipcode', 'zip_code', 'postal', 'postcode'],
  socials: ['socials', 'social', 'instagram', 'facebook', 'linkedin', 'social_media'],
  notes: ['notes', 'note', 'comment', 'comments', 'description', 'pain'],
};

export function mapCsvRow(raw: Record<string, string>): ImportLeadRow {
  const norm: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    norm[k.trim().toLowerCase().replace(/\s+/g, '_')] = v;
  }
  const out: ImportLeadRow = {};
  for (const field of Object.keys(ALIASES) as (keyof ImportLeadRow)[]) {
    for (const alias of ALIASES[field]) {
      const key = alias.replace(/\s+/g, '_');
      if (norm[key] !== undefined && norm[key] !== '') {
        out[field] = norm[key];
        break;
      }
    }
  }
  return out;
}
