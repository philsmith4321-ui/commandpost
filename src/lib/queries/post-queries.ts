import type Database from 'better-sqlite3';
import type { Post, PostVariant, PostWithVariants, PostStatus, VariantStatus } from '@/lib/types';
import { type Platform, PLATFORM_ORDER } from '@/lib/platforms';

export interface CreatePostInput {
  title: string;
  idea?: string | null;
  image_path?: string | null;
  status?: PostStatus;
  scheduled_at?: string | null;
  variants: { platform: Platform; content: string; enabled: boolean }[];
}

export interface UpdatePostInput {
  title?: string;
  idea?: string | null;
  image_path?: string | null;
  status?: PostStatus;
  scheduled_at?: string | null;
}

export interface PostListItem extends Post {
  platforms: Platform[];
}

function orderIndex(platform: Platform): number {
  return PLATFORM_ORDER.indexOf(platform);
}

export function createPost(db: Database.Database, input: CreatePostInput): number {
  const result = db
    .prepare(
      `INSERT INTO posts (title, idea, image_path, status, scheduled_at)
       VALUES (@title, @idea, @image_path, @status, @scheduled_at)`
    )
    .run({
      title: input.title,
      idea: input.idea ?? null,
      image_path: input.image_path ?? null,
      status: input.status ?? 'draft',
      scheduled_at: input.scheduled_at ?? null,
    });

  const postId = Number(result.lastInsertRowid);

  const insertVariant = db.prepare(
    'INSERT INTO post_variants (post_id, platform, content, enabled) VALUES (?, ?, ?, ?)'
  );
  for (const v of input.variants) {
    insertVariant.run(postId, v.platform, v.content, v.enabled ? 1 : 0);
  }

  return postId;
}

export function getPostById(db: Database.Database, id: number): PostWithVariants | undefined {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as Post | undefined;
  if (!post) return undefined;

  const variants = db
    .prepare('SELECT * FROM post_variants WHERE post_id = ?')
    .all(id) as PostVariant[];
  variants.sort((a, b) => orderIndex(a.platform) - orderIndex(b.platform));

  return { ...post, variants };
}

export function listPosts(db: Database.Database, statusFilter?: string): PostListItem[] {
  let sql = 'SELECT * FROM posts';
  const params: unknown[] = [];
  if (statusFilter && statusFilter !== 'all') {
    sql += ' WHERE status = ?';
    params.push(statusFilter);
  }
  sql += ' ORDER BY created_at DESC, id DESC';

  const posts = db.prepare(sql).all(...params) as Post[];

  return posts.map((post) => {
    const rows = db
      .prepare('SELECT platform FROM post_variants WHERE post_id = ? AND enabled = 1')
      .all(post.id) as { platform: Platform }[];
    const platforms = rows.map((r) => r.platform).sort((a, b) => orderIndex(a) - orderIndex(b));
    return { ...post, platforms };
  });
}

export function updatePost(db: Database.Database, id: number, input: UpdatePostInput): void {
  const fields: string[] = [];
  const params: Record<string, unknown> = { id };

  if (input.title !== undefined) { fields.push('title = @title'); params.title = input.title; }
  if (input.idea !== undefined) { fields.push('idea = @idea'); params.idea = input.idea; }
  if (input.image_path !== undefined) { fields.push('image_path = @image_path'); params.image_path = input.image_path; }
  if (input.status !== undefined) { fields.push('status = @status'); params.status = input.status; }
  if (input.scheduled_at !== undefined) { fields.push('scheduled_at = @scheduled_at'); params.scheduled_at = input.scheduled_at; }

  if (fields.length === 0) return;

  fields.push("updated_at = datetime('now')");
  db.prepare(`UPDATE posts SET ${fields.join(', ')} WHERE id = @id`).run(params);
}

export function deletePost(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM posts WHERE id = ?').run(id);
}

export function upsertVariant(
  db: Database.Database,
  postId: number,
  platform: Platform,
  fields: { content?: string; enabled?: boolean; status?: VariantStatus }
): void {
  const existing = db
    .prepare('SELECT id FROM post_variants WHERE post_id = ? AND platform = ?')
    .get(postId, platform) as { id: number } | undefined;

  if (existing) {
    const sets: string[] = [];
    const params: Record<string, unknown> = { id: existing.id };
    if (fields.content !== undefined) { sets.push('content = @content'); params.content = fields.content; }
    if (fields.enabled !== undefined) { sets.push('enabled = @enabled'); params.enabled = fields.enabled ? 1 : 0; }
    if (fields.status !== undefined) { sets.push('status = @status'); params.status = fields.status; }
    if (sets.length > 0) {
      db.prepare(`UPDATE post_variants SET ${sets.join(', ')} WHERE id = @id`).run(params);
    }
  } else {
    db.prepare(
      'INSERT INTO post_variants (post_id, platform, content, enabled, status) VALUES (?, ?, ?, ?, ?)'
    ).run(postId, platform, fields.content ?? '', fields.enabled ? 1 : 0, fields.status ?? 'draft');
  }
}

export function setVariantStatus(
  db: Database.Database,
  variantId: number,
  status: VariantStatus,
  opts?: { published_at?: string; platform_post_id?: string; error?: string | null }
): void {
  db.prepare(
    `UPDATE post_variants
     SET status = @status, published_at = @published_at, platform_post_id = @platform_post_id, error = @error
     WHERE id = @id`
  ).run({
    id: variantId,
    status,
    published_at: opts?.published_at ?? null,
    platform_post_id: opts?.platform_post_id ?? null,
    error: opts?.error ?? null,
  });
}

export function syncPostPosted(db: Database.Database, postId: number): void {
  const post = db.prepare('SELECT status FROM posts WHERE id = ?').get(postId) as
    | { status: PostStatus }
    | undefined;
  if (!post || post.status === 'archived') return;

  const enabled = db
    .prepare('SELECT status FROM post_variants WHERE post_id = ? AND enabled = 1')
    .all(postId) as { status: VariantStatus }[];

  if (enabled.length > 0 && enabled.every((v) => v.status === 'posted')) {
    db.prepare("UPDATE posts SET status = 'posted', updated_at = datetime('now') WHERE id = ?").run(postId);
  }
}
