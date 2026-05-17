import type Database from 'better-sqlite3';

export interface FollowUpLead {
  id: number;
  business_name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  stage: string;
  follow_up_date: string;
  days_overdue: number;
  estimated_value: number | null;
  last_note: string | null;
}

export function getOverdueFollowUps(db: Database.Database): FollowUpLead[] {
  const today = new Date().toISOString().split('T')[0];
  return db.prepare(`
    SELECT l.id, l.business_name, l.contact_person, l.email, l.phone, l.stage,
      l.follow_up_date, l.estimated_value,
      CAST(julianday(?) - julianday(l.follow_up_date) AS INTEGER) as days_overdue,
      (SELECT content FROM lead_notes WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1) as last_note
    FROM leads l
    WHERE l.follow_up_date IS NOT NULL
      AND l.follow_up_date <= ?
      AND l.stage NOT IN ('won', 'lost')
    ORDER BY l.follow_up_date ASC
  `).all(today, today) as FollowUpLead[];
}

export function getUpcomingFollowUps(db: Database.Database, days: number = 7): FollowUpLead[] {
  const today = new Date().toISOString().split('T')[0];
  const future = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  return db.prepare(`
    SELECT l.id, l.business_name, l.contact_person, l.email, l.phone, l.stage,
      l.follow_up_date, l.estimated_value,
      0 as days_overdue,
      (SELECT content FROM lead_notes WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1) as last_note
    FROM leads l
    WHERE l.follow_up_date IS NOT NULL
      AND l.follow_up_date > ?
      AND l.follow_up_date <= ?
      AND l.stage NOT IN ('won', 'lost')
    ORDER BY l.follow_up_date ASC
  `).all(today, future) as FollowUpLead[];
}

export function snoozeFollowUp(db: Database.Database, leadId: number, days: number): void {
  const newDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  db.prepare("UPDATE leads SET follow_up_date = ?, updated_at = datetime('now') WHERE id = ?").run(newDate, leadId);
}
