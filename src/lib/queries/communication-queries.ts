import type Database from 'better-sqlite3';

export interface CommunicationRow {
  id: number;
  client_id: number;
  comm_type: string;
  subject: string;
  body: string | null;
  comm_date: string;
  created_at: string;
}

export function listCommunications(db: Database.Database, clientId: number): CommunicationRow[] {
  return db.prepare('SELECT * FROM communications WHERE client_id = ? ORDER BY comm_date DESC').all(clientId) as CommunicationRow[];
}

export function createCommunication(db: Database.Database, input: {
  client_id: number;
  comm_type: string;
  subject: string;
  body?: string | null;
  comm_date?: string;
}): number {
  const result = db.prepare(
    'INSERT INTO communications (client_id, comm_type, subject, body, comm_date) VALUES (?, ?, ?, ?, ?)'
  ).run(input.client_id, input.comm_type, input.subject, input.body ?? null, input.comm_date || new Date().toISOString().slice(0, 10));
  return Number(result.lastInsertRowid);
}

export function deleteCommunication(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM communications WHERE id = ?').run(id);
}
