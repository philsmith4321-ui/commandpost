import type Database from 'better-sqlite3';

export interface EmailLogEntry {
  id: number;
  client_id: number | null;
  client_name: string | null;
  recipient_email: string;
  subject: string;
  email_type: string;
  reference_id: number | null;
  sent_at: string;
}

export function logEmail(db: Database.Database, input: {
  client_id?: number | null;
  recipient_email: string;
  subject: string;
  email_type: string;
  reference_id?: number | null;
}): number {
  const result = db.prepare(
    'INSERT INTO email_log (client_id, recipient_email, subject, email_type, reference_id) VALUES (?, ?, ?, ?, ?)'
  ).run(input.client_id ?? null, input.recipient_email, input.subject, input.email_type, input.reference_id ?? null);
  return Number(result.lastInsertRowid);
}

export function listEmailLog(db: Database.Database, limit = 100): EmailLogEntry[] {
  return db.prepare(`
    SELECT e.*, c.name as client_name
    FROM email_log e LEFT JOIN clients c ON e.client_id = c.id
    ORDER BY e.sent_at DESC
    LIMIT ?
  `).all(limit) as EmailLogEntry[];
}

export function getClientEmails(db: Database.Database, clientId: number): EmailLogEntry[] {
  return db.prepare(`
    SELECT e.*, c.name as client_name
    FROM email_log e LEFT JOIN clients c ON e.client_id = c.id
    WHERE e.client_id = ?
    ORDER BY e.sent_at DESC
  `).all(clientId) as EmailLogEntry[];
}
