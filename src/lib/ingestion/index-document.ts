import type Database from 'better-sqlite3';
import { replaceChunks } from '@/lib/queries/kb-queries';
import { chunkText } from '@/lib/ingestion/chunk';

/** Chunk a KB document's content into kb_chunks (embeddings filled later by backfill). */
export function indexDocument(db: Database.Database, kbDocumentId: number, content: string): number {
  const chunks = chunkText(content);
  replaceChunks(db, kbDocumentId, chunks);
  return chunks.length;
}
