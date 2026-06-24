import type Database from 'better-sqlite3';
import type {
  MediaItem,
  MediaClip,
  MediaItemWithClips,
  MediaType,
  MediaSource,
  MediaStatus,
  ClipStatus,
} from '@/lib/types';

export interface CreateMediaItemInput {
  title: string;
  media_type?: MediaType;
  source?: MediaSource;
  filename?: string | null;
  original_name?: string | null;
  mime_type?: string | null;
  size?: number;
  duration_seconds?: number | null;
  transcript?: string | null;
  segments?: string | null;
  status?: MediaStatus;
}

export function createMediaItem(db: Database.Database, input: CreateMediaItemInput): number {
  const result = db
    .prepare(
      `INSERT INTO media_items
        (title, media_type, source, filename, original_name, mime_type, size,
         duration_seconds, transcript, segments, status)
       VALUES
        (@title, @media_type, @source, @filename, @original_name, @mime_type, @size,
         @duration_seconds, @transcript, @segments, @status)`
    )
    .run({
      title: input.title,
      media_type: input.media_type ?? 'podcast',
      source: input.source ?? 'upload',
      filename: input.filename ?? null,
      original_name: input.original_name ?? null,
      mime_type: input.mime_type ?? null,
      size: input.size ?? 0,
      duration_seconds: input.duration_seconds ?? null,
      transcript: input.transcript ?? null,
      segments: input.segments ?? null,
      status: input.status ?? 'queued',
    });
  return Number(result.lastInsertRowid);
}

export interface UpdateMediaItemInput {
  duration_seconds?: number | null;
  transcript?: string | null;
  segments?: string | null;
  status?: MediaStatus;
  error?: string | null;
}

export function updateMediaItem(db: Database.Database, id: number, input: UpdateMediaItemInput): void {
  const fields: string[] = [];
  const params: Record<string, unknown> = { id };
  if (input.duration_seconds !== undefined) { fields.push('duration_seconds = @duration_seconds'); params.duration_seconds = input.duration_seconds; }
  if (input.transcript !== undefined) { fields.push('transcript = @transcript'); params.transcript = input.transcript; }
  if (input.segments !== undefined) { fields.push('segments = @segments'); params.segments = input.segments; }
  if (input.status !== undefined) { fields.push('status = @status'); params.status = input.status; }
  if (input.error !== undefined) { fields.push('error = @error'); params.error = input.error; }
  if (fields.length === 0) return;
  fields.push("updated_at = datetime('now')");
  db.prepare(`UPDATE media_items SET ${fields.join(', ')} WHERE id = @id`).run(params);
}

export function getMediaItem(db: Database.Database, id: number): MediaItem | undefined {
  return db.prepare('SELECT * FROM media_items WHERE id = ?').get(id) as MediaItem | undefined;
}

export function getMediaItemWithClips(db: Database.Database, id: number): MediaItemWithClips | undefined {
  const item = getMediaItem(db, id);
  if (!item) return undefined;
  const clips = listClips(db, id);
  return { ...item, clips };
}

export function listMediaItems(db: Database.Database): MediaItem[] {
  return db
    .prepare('SELECT * FROM media_items ORDER BY created_at DESC, id DESC')
    .all() as MediaItem[];
}

export function listMediaItemsWithClips(db: Database.Database): MediaItemWithClips[] {
  return listMediaItems(db).map((item) => ({ ...item, clips: listClips(db, item.id) }));
}

export function deleteMediaItem(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM media_items WHERE id = ?').run(id);
}

export interface CreateClipInput {
  media_item_id: number;
  title: string;
  start_seconds: number;
  end_seconds: number;
  transcript_excerpt?: string | null;
  reason?: string | null;
}

export function createClip(db: Database.Database, input: CreateClipInput): number {
  const result = db
    .prepare(
      `INSERT INTO media_clips
        (media_item_id, title, start_seconds, end_seconds, transcript_excerpt, reason)
       VALUES
        (@media_item_id, @title, @start_seconds, @end_seconds, @transcript_excerpt, @reason)`
    )
    .run({
      media_item_id: input.media_item_id,
      title: input.title,
      start_seconds: input.start_seconds,
      end_seconds: input.end_seconds,
      transcript_excerpt: input.transcript_excerpt ?? null,
      reason: input.reason ?? null,
    });
  return Number(result.lastInsertRowid);
}

export function replaceClips(db: Database.Database, mediaItemId: number, clips: CreateClipInput[]): void {
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM media_clips WHERE media_item_id = ? AND status = 'suggested'").run(mediaItemId);
    for (const c of clips) createClip(db, c);
  });
  tx();
}

export function listClips(db: Database.Database, mediaItemId: number): MediaClip[] {
  return db
    .prepare('SELECT * FROM media_clips WHERE media_item_id = ? ORDER BY start_seconds ASC, id ASC')
    .all(mediaItemId) as MediaClip[];
}

export function getClip(db: Database.Database, id: number): MediaClip | undefined {
  return db.prepare('SELECT * FROM media_clips WHERE id = ?').get(id) as MediaClip | undefined;
}

export function setClipCut(db: Database.Database, id: number, clipFilename: string): void {
  db.prepare("UPDATE media_clips SET clip_filename = ?, status = 'cut' WHERE id = ?").run(clipFilename, id);
}

export function setClipStatus(db: Database.Database, id: number, status: ClipStatus): void {
  db.prepare('UPDATE media_clips SET status = ? WHERE id = ?').run(status, id);
}
