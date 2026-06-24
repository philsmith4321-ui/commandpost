import type Database from 'better-sqlite3';
import type { KbDocument, KbSourceType } from '@/lib/types';

export interface CreateKbInput {
  title: string;
  source_type: KbSourceType;
  source_url?: string | null;
  content: string;
}

export function createKbDocument(db: Database.Database, input: CreateKbInput): number {
  const content = input.content ?? '';
  const result = db
    .prepare(
      `INSERT INTO kb_documents (title, source_type, source_url, content, char_count)
       VALUES (@title, @source_type, @source_url, @content, @char_count)`
    )
    .run({
      title: input.title,
      source_type: input.source_type,
      source_url: input.source_url ?? null,
      content,
      char_count: content.length,
    });
  return Number(result.lastInsertRowid);
}

/** List KB documents (metadata only — content excluded for list views). */
export function listKbDocuments(db: Database.Database, search?: string): Omit<KbDocument, 'content'>[] {
  const q = (search ?? '').trim();
  if (q) {
    const like = `%${q}%`;
    return db
      .prepare(
        `SELECT id, title, source_type, source_url, char_count, created_at
         FROM kb_documents
         WHERE title LIKE ? OR content LIKE ?
         ORDER BY created_at DESC, id DESC`
      )
      .all(like, like) as Omit<KbDocument, 'content'>[];
  }
  return db
    .prepare(
      `SELECT id, title, source_type, source_url, char_count, created_at
       FROM kb_documents ORDER BY created_at DESC, id DESC`
    )
    .all() as Omit<KbDocument, 'content'>[];
}

export function getKbDocument(db: Database.Database, id: number): KbDocument | undefined {
  return db.prepare('SELECT * FROM kb_documents WHERE id = ?').get(id) as KbDocument | undefined;
}

export function deleteKbDocument(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM kb_documents WHERE id = ?').run(id);
}

export function kbStats(db: Database.Database): { count: number; chars: number } {
  const row = db
    .prepare('SELECT COUNT(*) as count, COALESCE(SUM(char_count),0) as chars FROM kb_documents')
    .get() as { count: number; chars: number };
  return row;
}
