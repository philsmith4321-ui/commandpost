import type Database from 'better-sqlite3';

export interface Meeting {
  id: number;
  client_id: number;
  project_id: number | null;
  title: string;
  meeting_date: string;
  duration_minutes: number | null;
  notes: string | null;
  action_items: string | null;
  created_at: string;
}

export interface MeetingWithContext extends Meeting {
  client_name: string;
  project_name: string | null;
}

export function listMeetings(db: Database.Database, limit = 50): MeetingWithContext[] {
  return db.prepare(`
    SELECT m.*, c.name as client_name, p.name as project_name
    FROM meetings m
    JOIN clients c ON m.client_id = c.id
    LEFT JOIN projects p ON m.project_id = p.id
    WHERE c.deleted_at IS NULL
    ORDER BY m.meeting_date DESC
    LIMIT ?
  `).all(limit) as MeetingWithContext[];
}

export function getClientMeetings(db: Database.Database, clientId: number): Meeting[] {
  return db.prepare('SELECT * FROM meetings WHERE client_id = ? ORDER BY meeting_date DESC').all(clientId) as Meeting[];
}

export function getMeetingById(db: Database.Database, id: number): MeetingWithContext | undefined {
  return db.prepare(`
    SELECT m.*, c.name as client_name, p.name as project_name
    FROM meetings m JOIN clients c ON m.client_id = c.id LEFT JOIN projects p ON m.project_id = p.id
    WHERE m.id = ?
  `).get(id) as MeetingWithContext | undefined;
}

export function createMeeting(db: Database.Database, data: {
  client_id: number;
  project_id?: number;
  title: string;
  meeting_date: string;
  duration_minutes?: number;
  notes?: string;
  action_items?: string;
}): number {
  const result = db.prepare(`
    INSERT INTO meetings (client_id, project_id, title, meeting_date, duration_minutes, notes, action_items)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(data.client_id, data.project_id || null, data.title, data.meeting_date, data.duration_minutes || null, data.notes || null, data.action_items || null);
  return Number(result.lastInsertRowid);
}
