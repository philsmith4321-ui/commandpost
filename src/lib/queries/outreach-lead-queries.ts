import type Database from 'better-sqlite3';
import type { Lead, OutreachChannel } from '@/lib/types';
import { updateLeadStage, addLeadNote } from '@/lib/queries/lead-queries';
import { milesBetweenZips } from '@/lib/outreach/geo';
import { parseEmployees, bucketOf, type BucketKey } from '@/lib/outreach/employee-size';

// A lead plus a derived summary of its outreach activity, for the Leads tab list.
export interface OutreachLead extends Lead {
  letter_sent_at: string | null;
  email_sent_at: string | null;
  linkedin_sent_at: string | null;
  fb_sent_at: string | null;
  draft_letter: string | null;
  draft_email: string | null;
  draft_linkedin: string | null;
  draft_fb: string | null;
  touch_count: number;
  do_not_email: number | null;
  sequence_enrolled_at: string | null;
  sequence_steps_sent: number;
  research_notes: string | null;
  researched_at: string | null;
}

export interface LeadFilters {
  stage?: string;
  uncontactedOnly?: boolean;
  segment?: string;
  category?: string;
  city?: string;
  sizes?: BucketKey[];
  nearZip?: string;
  withinMiles?: number;
}

export function listLeadsByLane(
  db: Database.Database,
  lane: string,
  opts: LeadFilters = {}
): OutreachLead[] {
  const where: string[] = ['l.lane = @lane'];
  const params: Record<string, string> = { lane };
  if (opts.stage) {
    where.push('l.stage = @stage');
    params.stage = opts.stage;
  }
  if (opts.uncontactedOnly) where.push("l.stage = 'new'");
  if (opts.segment) {
    where.push('l.segment = @segment');
    params.segment = opts.segment;
  }
  if (opts.category) {
    where.push('l.category = @category');
    params.category = opts.category;
  }
  if (opts.city) {
    where.push('lower(l.city) = lower(@city)');
    params.city = opts.city;
  }

  let rows = db
    .prepare(
      `SELECT l.*,
         (SELECT MAX(sent_at) FROM outreach_touches t WHERE t.lead_id = l.id AND t.channel = 'letter')   AS letter_sent_at,
         (SELECT MAX(sent_at) FROM outreach_touches t WHERE t.lead_id = l.id AND t.channel = 'email')    AS email_sent_at,
         (SELECT MAX(sent_at) FROM outreach_touches t WHERE t.lead_id = l.id AND t.channel = 'linkedin') AS linkedin_sent_at,
         (SELECT MAX(sent_at) FROM outreach_touches t WHERE t.lead_id = l.id AND t.channel = 'fb')       AS fb_sent_at,
         (SELECT COUNT(*)     FROM outreach_touches t WHERE t.lead_id = l.id)                            AS touch_count,
         (SELECT COUNT(*)     FROM sequence_sends s  WHERE s.lead_id = l.id AND s.ok = 1)                AS sequence_steps_sent
       FROM leads l
       WHERE ${where.join(' AND ')}
       ORDER BY (l.stage = 'new') DESC, l.updated_at DESC`
    )
    .all(params) as OutreachLead[];

  // Size buckets and ZIP-distance are applied in JS (the set is small).
  if (opts.sizes && opts.sizes.length) {
    const set = new Set(opts.sizes);
    rows = rows.filter((r) => {
      const b = bucketOf(r.employee_min, r.employee_max);
      return b != null && set.has(b);
    });
  }
  if (opts.nearZip && opts.withinMiles != null) {
    const within = opts.withinMiles;
    rows = rows.filter((r) => {
      const d = milesBetweenZips(r.postal_code, opts.nearZip);
      return d != null && d <= within;
    });
  }
  return rows;
}

// Distinct non-null values among a lane's leads, for the filter dropdowns.
export function laneFacets(
  db: Database.Database,
  lane: string
): { segments: string[]; categories: string[]; cities: string[] } {
  const distinct = (col: string) =>
    (
      db
        .prepare(
          `SELECT DISTINCT ${col} AS v FROM leads WHERE lane = ? AND ${col} IS NOT NULL AND ${col} <> '' ORDER BY ${col}`
        )
        .all(lane) as { v: string }[]
    ).map((r) => r.v);
  return { segments: distinct('segment'), categories: distinct('category'), cities: distinct('city') };
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
// sentAt (optional YYYY-MM-DD) backdates the send; omit it to stamp the current time.
export function logTouch(
  db: Database.Database,
  leadId: number,
  channel: OutreachChannel,
  note?: string | null,
  sentAt?: string | null
): void {
  const backdate = sentAt && /^\d{4}-\d{2}-\d{2}$/.test(sentAt) ? sentAt : null;
  if (backdate) {
    db.prepare('INSERT INTO outreach_touches (lead_id, channel, sent_at, note) VALUES (?, ?, ?, ?)').run(
      leadId,
      channel,
      backdate,
      note?.trim() ? note.trim() : null
    );
  } else {
    db.prepare('INSERT INTO outreach_touches (lead_id, channel, note) VALUES (?, ?, ?)').run(
      leadId,
      channel,
      note?.trim() ? note.trim() : null
    );
  }
  const lead = db.prepare('SELECT stage FROM leads WHERE id = ?').get(leadId) as { stage: string } | undefined;
  if (lead?.stage === 'new') {
    updateLeadStage(db, leadId, 'contacted');
  } else {
    db.prepare("UPDATE leads SET updated_at = datetime('now') WHERE id = ?").run(leadId);
  }
}

// Undo a logged send: remove every touch of this channel for the lead.
// If that leaves the lead with no touches at all, walk it back to "new"
// (uncontacted) so the filters/counts reflect reality — handy while testing.
export function clearTouch(db: Database.Database, leadId: number, channel: OutreachChannel): void {
  db.prepare('DELETE FROM outreach_touches WHERE lead_id = ? AND channel = ?').run(leadId, channel);
  const remaining = db
    .prepare('SELECT COUNT(*) AS n FROM outreach_touches WHERE lead_id = ?')
    .get(leadId) as { n: number };
  const lead = db.prepare('SELECT stage FROM leads WHERE id = ?').get(leadId) as { stage: string } | undefined;
  if (remaining.n === 0 && lead?.stage === 'contacted') {
    updateLeadStage(db, leadId, 'new');
  } else {
    db.prepare("UPDATE leads SET updated_at = datetime('now') WHERE id = ?").run(leadId);
  }
}

// Persist the latest auto-drafted (or edited) outreach copy for a channel.
// Channel is whitelisted to a fixed column name — never interpolate raw input.
const DRAFT_COLUMNS: Record<string, string> = {
  letter: 'draft_letter',
  email: 'draft_email',
  linkedin: 'draft_linkedin',
  fb: 'draft_fb',
};

export function saveDraft(db: Database.Database, leadId: number, channel: OutreachChannel, body: string): void {
  const col = DRAFT_COLUMNS[channel];
  if (!col) return;
  db.prepare(`UPDATE leads SET ${col} = ?, updated_at = datetime('now') WHERE id = ?`).run(body, leadId);
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
  segment?: string;
  category?: string;
  employees?: string; // raw band, e.g. "51-200" / "~53 est" — parsed to min/max on insert
}

const trimOrNull = (v?: string): string | null => (v && v.trim() ? v.trim() : null);

// Insert mapped rows as leads for a lane. Dedupes on (business_name+street) or email.
export function importLeads(
  db: Database.Database,
  rows: ImportLeadRow[],
  lane: string
): { imported: number; skipped: number } {
  const insert = db.prepare(
    `INSERT INTO leads (business_name, contact_person, email, phone, website, street, city, state, postal_code, socials, segment, category, employee_min, employee_max, source, stage, lane)
     VALUES (@business_name, @contact_person, @email, @phone, @website, @street, @city, @state, @postal_code, @socials, @segment, @category, @employee_min, @employee_max, 'outbound', 'new', @lane)`
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
      const { min: employee_min, max: employee_max } = parseEmployees(r.employees);
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
        segment: trimOrNull(r.segment),
        category: trimOrNull(r.category),
        employee_min,
        employee_max,
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
  notes: ['notes', 'note', 'comment', 'comments', 'description', 'pain', 'notes_/_confidence', 'notes / confidence'],
  segment: ['segment', 'type', 'vertical'],
  category: ['category', 'industry', 'sub-industry', 'sub_industry', 'niche'],
  employees: ['employees', 'est. employees', 'est employees', 'employee_count', 'headcount', 'size', 'company_size', 'est._employees'],
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
