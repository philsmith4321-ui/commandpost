import type Database from 'better-sqlite3';

export interface DocumentRow {
  id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  entity_type: string;
  entity_id: number;
  uploaded_at: string;
}

export function createDocument(db: Database.Database, input: {
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  entity_type: string;
  entity_id: number;
}): number {
  const result = db.prepare(
    'INSERT INTO documents (filename, original_name, mime_type, size, entity_type, entity_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(input.filename, input.original_name, input.mime_type, input.size, input.entity_type, input.entity_id);
  return Number(result.lastInsertRowid);
}

export function getDocumentsForEntity(db: Database.Database, entityType: string, entityId: number): DocumentRow[] {
  return db.prepare(
    'SELECT * FROM documents WHERE entity_type = ? AND entity_id = ? ORDER BY uploaded_at DESC'
  ).all(entityType, entityId) as DocumentRow[];
}

export function getDocument(db: Database.Database, id: number): DocumentRow | undefined {
  return db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as DocumentRow | undefined;
}

export function deleteDocument(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM documents WHERE id = ?').run(id);
}

export function listRecentDocuments(db: Database.Database, limit = 50): DocumentRow[] {
  return db.prepare('SELECT * FROM documents ORDER BY uploaded_at DESC LIMIT ?').all(limit) as DocumentRow[];
}

// Legacy client_documents table support
export interface ClientDocument {
  id: number;
  client_id: number;
  title: string;
  doc_type: string;
  content: string | null;
  url: string | null;
  created_at: string;
}

export function listClientDocuments(db: Database.Database, clientId: number): ClientDocument[] {
  return db.prepare('SELECT * FROM client_documents WHERE client_id = ? ORDER BY created_at DESC').all(clientId) as ClientDocument[];
}

export function createClientDocument(db: Database.Database, input: {
  client_id: number; title: string; doc_type: string; content?: string | null; url?: string | null;
}): number {
  const result = db.prepare(
    'INSERT INTO client_documents (client_id, title, doc_type, content, url) VALUES (?, ?, ?, ?, ?)'
  ).run(input.client_id, input.title, input.doc_type, input.content ?? null, input.url ?? null);
  return Number(result.lastInsertRowid);
}

export function deleteClientDocument(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM client_documents WHERE id = ?').run(id);
}
