import type Database from 'better-sqlite3';
import type { Avatar } from '@/lib/types';

export interface AvatarInput {
  name: string;
  summary?: string | null;
  description?: string | null;
  tone?: string | null;
  is_active?: boolean;
  persona?: string | null;
  buying_trigger?: string | null;
  proof_point?: string | null;
  writing_target?: string | null;
  what_tried?: string | null;
  pains?: string[];
  desires?: string[];
  objections?: string[];
  vocabulary?: string[];
  trust_triggers?: string[];
  channels?: string[];
}

function parseArray(v: unknown): string[] {
  if (typeof v !== 'string' || !v) return [];
  try { const a = JSON.parse(v); return Array.isArray(a) ? a.map(String) : []; } catch { return []; }
}

function mapRow(row: Record<string, unknown>): Avatar {
  return {
    id: row.id as number,
    name: row.name as string,
    summary: (row.summary as string) ?? null,
    description: (row.description as string) ?? null,
    tone: (row.tone as string) ?? null,
    is_active: row.is_active as number,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    persona: (row.persona as string) ?? null,
    buying_trigger: (row.buying_trigger as string) ?? null,
    proof_point: (row.proof_point as string) ?? null,
    writing_target: (row.writing_target as string) ?? null,
    what_tried: (row.what_tried as string) ?? null,
    pains: parseArray(row.pains),
    desires: parseArray(row.desires),
    objections: parseArray(row.objections),
    vocabulary: parseArray(row.vocabulary),
    trust_triggers: parseArray(row.trust_triggers),
    channels: parseArray(row.channels),
  };
}

function writeParams(input: AvatarInput) {
  return {
    name: input.name,
    summary: input.summary ?? null,
    description: input.description ?? null,
    tone: input.tone ?? null,
    is_active: input.is_active === false ? 0 : 1,
    persona: input.persona ?? null,
    buying_trigger: input.buying_trigger ?? null,
    proof_point: input.proof_point ?? null,
    writing_target: input.writing_target ?? null,
    what_tried: input.what_tried ?? null,
    pains: JSON.stringify(input.pains ?? []),
    desires: JSON.stringify(input.desires ?? []),
    objections: JSON.stringify(input.objections ?? []),
    vocabulary: JSON.stringify(input.vocabulary ?? []),
    trust_triggers: JSON.stringify(input.trust_triggers ?? []),
    channels: JSON.stringify(input.channels ?? []),
  };
}

export function createAvatar(db: Database.Database, input: AvatarInput): number {
  const result = db.prepare(
    `INSERT INTO avatars
       (name, summary, description, tone, is_active, persona, buying_trigger, proof_point,
        writing_target, what_tried, pains, desires, objections, vocabulary, trust_triggers, channels)
     VALUES
       (@name, @summary, @description, @tone, @is_active, @persona, @buying_trigger, @proof_point,
        @writing_target, @what_tried, @pains, @desires, @objections, @vocabulary, @trust_triggers, @channels)`
  ).run(writeParams(input));
  return Number(result.lastInsertRowid);
}

export function listAvatars(db: Database.Database, activeOnly = false): Avatar[] {
  const sql = activeOnly
    ? 'SELECT * FROM avatars WHERE is_active = 1 ORDER BY name COLLATE NOCASE'
    : 'SELECT * FROM avatars ORDER BY name COLLATE NOCASE';
  return (db.prepare(sql).all() as Record<string, unknown>[]).map(mapRow);
}

export function getAvatar(db: Database.Database, id: number): Avatar | undefined {
  const row = db.prepare('SELECT * FROM avatars WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? mapRow(row) : undefined;
}

export function updateAvatar(db: Database.Database, id: number, input: AvatarInput): void {
  db.prepare(
    `UPDATE avatars SET
       name=@name, summary=@summary, description=@description, tone=@tone, is_active=@is_active,
       persona=@persona, buying_trigger=@buying_trigger, proof_point=@proof_point,
       writing_target=@writing_target, what_tried=@what_tried,
       pains=@pains, desires=@desires, objections=@objections, vocabulary=@vocabulary,
       trust_triggers=@trust_triggers, channels=@channels, updated_at=datetime('now')
     WHERE id=@id`
  ).run({ id, ...writeParams(input) });
}

export function deleteAvatar(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM avatars WHERE id = ?').run(id);
}
