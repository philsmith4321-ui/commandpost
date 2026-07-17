import type Database from 'better-sqlite3';
import type { KbDocument, KbSourceType, KbChunk } from '@/lib/types';
import { AUDIBLE_DOC_SET } from '@/lib/audible';

export interface CreateKbInput {
  title: string;
  source_type: KbSourceType;
  source_url?: string | null;
  content: string;
  /** NULL (default) = general KB; 'audible' = Audible set. This column is the fence. */
  doc_set?: string | null;
}

export function createKbDocument(db: Database.Database, input: CreateKbInput): number {
  const content = input.content ?? '';
  const result = db
    .prepare(
      `INSERT INTO kb_documents (title, source_type, source_url, content, char_count, doc_set)
       VALUES (@title, @source_type, @source_url, @content, @char_count, @doc_set)`
    )
    .run({
      title: input.title,
      source_type: input.source_type,
      source_url: input.source_url ?? null,
      content,
      char_count: content.length,
      doc_set: input.doc_set ?? null,
    });
  return Number(result.lastInsertRowid);
}

const KB_META_COLS = 'id, title, source_type, source_url, char_count, doc_set, created_at';
/** SQL fence: general (non-Audible) docs only. Keys on doc_set, never titles. */
const notAudible = (alias = '') => `(${alias}doc_set IS NULL OR ${alias}doc_set != '${AUDIBLE_DOC_SET}')`;
const NOT_AUDIBLE = notAudible();

/**
 * List general (non-Audible) KB documents (metadata only — content excluded
 * for list views). Audible docs are fenced out so ReKindleLeads-facing
 * surfaces (Generate picker, Ingestion KB list) never see them.
 */
export function listKbDocuments(db: Database.Database, search?: string): Omit<KbDocument, 'content'>[] {
  const q = (search ?? '').trim();
  if (q) {
    const like = `%${q}%`;
    return db
      .prepare(
        `SELECT ${KB_META_COLS}
         FROM kb_documents
         WHERE ${NOT_AUDIBLE} AND (title LIKE ? OR content LIKE ?)
         ORDER BY created_at DESC, id DESC`
      )
      .all(like, like) as Omit<KbDocument, 'content'>[];
  }
  return db
    .prepare(
      `SELECT ${KB_META_COLS}
       FROM kb_documents WHERE ${NOT_AUDIBLE} ORDER BY created_at DESC, id DESC`
    )
    .all() as Omit<KbDocument, 'content'>[];
}

/** List Audible-set KB documents (metadata only) — for the Audible AI page. */
export function listAudibleKbDocuments(db: Database.Database): Omit<KbDocument, 'content'>[] {
  return db
    .prepare(
      `SELECT ${KB_META_COLS}
       FROM kb_documents WHERE doc_set = ? ORDER BY created_at DESC, id DESC`
    )
    .all(AUDIBLE_DOC_SET) as Omit<KbDocument, 'content'>[];
}

export function getKbDocument(db: Database.Database, id: number): KbDocument | undefined {
  return db.prepare('SELECT * FROM kb_documents WHERE id = ?').get(id) as KbDocument | undefined;
}

export function deleteKbDocument(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM kb_documents WHERE id = ?').run(id);
}

export function kbStats(db: Database.Database): { count: number; chars: number } {
  const row = db
    .prepare(`SELECT COUNT(*) as count, COALESCE(SUM(char_count),0) as chars FROM kb_documents WHERE ${NOT_AUDIBLE}`)
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

function chunksQuery(db: Database.Database, docIds?: number[], excludeAudible = false): ChunkWithSource[] {
  if (docIds && docIds.length === 0) return [];
  let sql = `SELECT c.*, d.title as doc_title, d.source_type as source_type
             FROM kb_chunks c JOIN kb_documents d ON d.id = c.kb_document_id`;
  const where: string[] = [];
  const params: unknown[] = [];
  if (excludeAudible) {
    where.push(notAudible('d.'));
  }
  if (docIds && docIds.length) {
    where.push(`c.kb_document_id IN (${docIds.map(() => '?').join(',')})`);
    params.push(...docIds);
  }
  if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
  sql += ' ORDER BY c.kb_document_id, c.chunk_index';
  return db.prepare(sql).all(...params) as ChunkWithSource[];
}

/** Chunks for the given KB document ids (or all if undefined). No doc_set fence. */
export function chunksForDocuments(db: Database.Database, docIds?: number[]): ChunkWithSource[] {
  return chunksQuery(db, docIds);
}

/**
 * Same as chunksForDocuments but fenced to general (non-Audible) docs —
 * for surfaces that must never touch the Audible set (e.g. content ideas).
 */
export function chunksForDocumentsExcludingAudible(
  db: Database.Database,
  docIds?: number[]
): ChunkWithSource[] {
  return chunksQuery(db, docIds, true);
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
