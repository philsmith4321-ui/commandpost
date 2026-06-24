import type Database from 'better-sqlite3';
import type { KbDocument, KbSourceType, KbChunk } from '@/lib/types';

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

/* ---------------- chunks ---------------- */

export function replaceChunks(db: Database.Database, kbDocumentId: number, chunks: string[]): void {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM kb_chunks WHERE kb_document_id = ?').run(kbDocumentId);
    const insert = db.prepare(
      'INSERT INTO kb_chunks (kb_document_id, chunk_index, text) VALUES (?, ?, ?)'
    );
    chunks.forEach((text, i) => insert.run(kbDocumentId, i, text));
  });
  tx();
}

export interface ChunkWithSource extends KbChunk {
  doc_title: string;
  source_type: KbSourceType;
}

/** Chunks for the given KB document ids (or all if undefined). */
export function chunksForDocuments(db: Database.Database, docIds?: number[]): ChunkWithSource[] {
  if (docIds && docIds.length === 0) return [];
  let sql = `SELECT c.*, d.title as doc_title, d.source_type as source_type
             FROM kb_chunks c JOIN kb_documents d ON d.id = c.kb_document_id`;
  const params: unknown[] = [];
  if (docIds && docIds.length) {
    sql += ` WHERE c.kb_document_id IN (${docIds.map(() => '?').join(',')})`;
    params.push(...docIds);
  }
  sql += ' ORDER BY c.kb_document_id, c.chunk_index';
  return db.prepare(sql).all(...params) as ChunkWithSource[];
}

export function chunksNeedingEmbedding(db: Database.Database, limit = 256): KbChunk[] {
  return db
    .prepare('SELECT * FROM kb_chunks WHERE embedding IS NULL ORDER BY id LIMIT ?')
    .all(limit) as KbChunk[];
}

export function setChunkEmbedding(db: Database.Database, chunkId: number, embedding: number[]): void {
  db.prepare('UPDATE kb_chunks SET embedding = ? WHERE id = ?').run(JSON.stringify(embedding), chunkId);
}

export function embeddingCounts(db: Database.Database): { total: number; embedded: number } {
  const total = (db.prepare('SELECT COUNT(*) as n FROM kb_chunks').get() as { n: number }).n;
  const embedded = (db.prepare('SELECT COUNT(*) as n FROM kb_chunks WHERE embedding IS NOT NULL').get() as { n: number }).n;
  return { total, embedded };
}
