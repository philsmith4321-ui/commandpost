import type Database from 'better-sqlite3';
import type { Avatar } from '@/lib/types';

export interface AvatarInput {
  name: string;
  summary?: string | null;
  description?: string | null;
  tone?: string | null;
  is_active?: boolean;
}

export function createAvatar(db: Database.Database, input: AvatarInput): number {
  const result = db
    .prepare(
      `INSERT INTO avatars (name, summary, description, tone, is_active)
       VALUES (@name, @summary, @description, @tone, @is_active)`
    )
    .run({
      name: input.name,
      summary: input.summary ?? null,
      description: input.description ?? null,
      tone: input.tone ?? null,
      is_active: input.is_active === false ? 0 : 1,
    });
  return Number(result.lastInsertRowid);
}

export function listAvatars(db: Database.Database, activeOnly = false): Avatar[] {
  const sql = activeOnly
    ? 'SELECT * FROM avatars WHERE is_active = 1 ORDER BY name COLLATE NOCASE'
    : 'SELECT * FROM avatars ORDER BY name COLLATE NOCASE';
  return db.prepare(sql).all() as Avatar[];
}

export function getAvatar(db: Database.Database, id: number): Avatar | undefined {
  return db.prepare('SELECT * FROM avatars WHERE id = ?').get(id) as Avatar | undefined;
}

export function updateAvatar(db: Database.Database, id: number, input: AvatarInput): void {
  db.prepare(
    `UPDATE avatars
     SET name = @name, summary = @summary, description = @description, tone = @tone,
         is_active = @is_active, updated_at = datetime('now')
     WHERE id = @id`
  ).run({
    id,
    name: input.name,
    summary: input.summary ?? null,
    description: input.description ?? null,
    tone: input.tone ?? null,
    is_active: input.is_active === false ? 0 : 1,
  });
}

export function deleteAvatar(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM avatars WHERE id = ?').run(id);
}
