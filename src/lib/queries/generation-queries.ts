import type Database from 'better-sqlite3';
import type { Generation, GenerationKind, GenContentType, LengthPreference, RetrievalMode } from '@/lib/types';

export interface CreateGenerationInput {
  content_type: GenContentType;
  topic: string;
  length: LengthPreference;
  source_ids: number[];
  retrieval_mode: RetrievalMode;
  avatar_id?: number | null;
  result: string;
  /** Origin fence: defaults to 'generate' (Generate page). */
  kind?: GenerationKind;
}

export function createGeneration(db: Database.Database, input: CreateGenerationInput): number {
  const result = db
    .prepare(
      `INSERT INTO generations (content_type, topic, length, source_ids, source_count, retrieval_mode, avatar_id, result, kind)
       VALUES (@content_type, @topic, @length, @source_ids, @source_count, @retrieval_mode, @avatar_id, @result, @kind)`
    )
    .run({
      content_type: input.content_type,
      topic: input.topic,
      length: input.length,
      source_ids: JSON.stringify(input.source_ids),
      source_count: input.source_ids.length,
      retrieval_mode: input.retrieval_mode,
      avatar_id: input.avatar_id ?? null,
      result: input.result,
      kind: input.kind ?? 'generate',
    });
  return Number(result.lastInsertRowid);
}

export function listGenerations(db: Database.Database, kind: GenerationKind = 'generate'): Generation[] {
  return db
    .prepare('SELECT * FROM generations WHERE kind = ? ORDER BY created_at DESC, id DESC LIMIT 100')
    .all(kind) as Generation[];
}

export function getGeneration(
  db: Database.Database,
  id: number,
  kind: GenerationKind = 'generate'
): Generation | undefined {
  return db
    .prepare('SELECT * FROM generations WHERE id = ? AND kind = ?')
    .get(id, kind) as Generation | undefined;
}

export function deleteGeneration(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM generations WHERE id = ?').run(id);
}

export function setGenerationBufferPostId(db: Database.Database, id: number, bufferPostId: string): void {
  db.prepare('UPDATE generations SET buffer_post_id = ? WHERE id = ?').run(bufferPostId, id);
}

export function listUnpushedSocialGenerations(db: Database.Database): Generation[] {
  return db
    .prepare(
      `SELECT * FROM generations
       WHERE buffer_post_id IS NULL
         AND kind = 'generate'
         AND content_type IN ('social_linkedin', 'social_twitter', 'social_facebook')
       ORDER BY created_at DESC, id DESC LIMIT 100`
    )
    .all() as Generation[];
}
