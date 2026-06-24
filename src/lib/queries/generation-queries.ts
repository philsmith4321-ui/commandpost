import type Database from 'better-sqlite3';
import type { Generation, GenContentType, LengthPreference, RetrievalMode } from '@/lib/types';

export interface CreateGenerationInput {
  content_type: GenContentType;
  topic: string;
  length: LengthPreference;
  source_ids: number[];
  retrieval_mode: RetrievalMode;
  avatar_id?: number | null;
  result: string;
}

export function createGeneration(db: Database.Database, input: CreateGenerationInput): number {
  const result = db
    .prepare(
      `INSERT INTO generations (content_type, topic, length, source_ids, source_count, retrieval_mode, avatar_id, result)
       VALUES (@content_type, @topic, @length, @source_ids, @source_count, @retrieval_mode, @avatar_id, @result)`
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
    });
  return Number(result.lastInsertRowid);
}

export function listGenerations(db: Database.Database): Generation[] {
  return db
    .prepare('SELECT * FROM generations ORDER BY created_at DESC, id DESC LIMIT 100')
    .all() as Generation[];
}

export function getGeneration(db: Database.Database, id: number): Generation | undefined {
  return db.prepare('SELECT * FROM generations WHERE id = ?').get(id) as Generation | undefined;
}

export function deleteGeneration(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM generations WHERE id = ?').run(id);
}
