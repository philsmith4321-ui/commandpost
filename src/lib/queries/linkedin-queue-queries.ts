import type Database from 'better-sqlite3';

// A lead ready for manual LinkedIn outreach: has a drafted message and a named
// contact to send it to. `linkedin_sent_at` comes from outreach_touches, so the
// cockpit can split to-send from already-sent.
export interface LinkedInQueueLead {
  id: number;
  business_name: string | null;
  contact_person: string | null;
  city: string | null;
  state: string | null;
  category: string | null;
  socials: string | null;
  draft_linkedin: string | null;
  replied_at: string | null;
  linkedin_sent_at: string | null;
}

export function listLinkedInQueue(db: Database.Database): LinkedInQueueLead[] {
  return db.prepare(`
    SELECT l.id, l.business_name, l.contact_person, l.city, l.state, l.category,
      l.socials, l.draft_linkedin, l.replied_at,
      (SELECT MAX(t.sent_at) FROM outreach_touches t WHERE t.lead_id = l.id AND t.channel = 'linkedin') AS linkedin_sent_at
    FROM leads l
    WHERE l.draft_linkedin IS NOT NULL AND trim(l.draft_linkedin) <> ''
      AND l.contact_person IS NOT NULL AND trim(l.contact_person) <> ''
    ORDER BY l.business_name COLLATE NOCASE, l.id
  `).all() as LinkedInQueueLead[];
}
