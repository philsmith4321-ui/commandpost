import type Database from 'better-sqlite3';

export interface ClientDocument {
  id: number;
  client_id: number;
  title: string;
  doc_type: 'note' | 'link' | 'file';
  content: string | null;
  url: string | null;
  created_at: string;
}

export function listClientDocuments(db: Database.Database, clientId: number): ClientDocument[] {
  return db.prepare(
    'SELECT * FROM client_documents WHERE client_id = ? ORDER BY created_at DESC'
  ).all(clientId) as ClientDocument[];
}

export function createClientDocument(db: Database.Database, input: {
  client_id: number;
  title: string;
  doc_type: 'note' | 'link' | 'file';
  content?: string | null;
  url?: string | null;
}): number {
  const result = db.prepare(
    'INSERT INTO client_documents (client_id, title, doc_type, content, url) VALUES (?, ?, ?, ?, ?)'
  ).run(input.client_id, input.title, input.doc_type, input.content ?? null, input.url ?? null);
  return Number(result.lastInsertRowid);
}

export function deleteClientDocument(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM client_documents WHERE id = ?').run(id);
}
