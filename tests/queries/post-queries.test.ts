import { describe, it, expect, beforeEach } from 'vitest';
import { initDb } from '@/lib/db';
import type Database from 'better-sqlite3';
import {
  createPost,
  getPostById,
  listPosts,
  updatePost,
  deletePost,
} from '@/lib/queries/post-queries';

let db: Database.Database;

beforeEach(() => {
  db = initDb(':memory:');
});

describe('posts schema', () => {
  it('creates posts and post_variants tables', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('posts','post_variants')")
      .all() as { name: string }[];
    const names = tables.map((t) => t.name).sort();
    expect(names).toEqual(['post_variants', 'posts']);
  });

  it('cascades variant deletion when a post is deleted', () => {
    db.prepare("INSERT INTO posts (title) VALUES ('Test')").run();
    db.prepare("INSERT INTO post_variants (post_id, platform, content) VALUES (1, 'x', 'hi')").run();
    db.prepare('DELETE FROM posts WHERE id = 1').run();
    const count = (db.prepare('SELECT COUNT(*) as c FROM post_variants').get() as { c: number }).c;
    expect(count).toBe(0);
  });
});

describe('createPost / getPostById', () => {
  it('creates a post with variants and reads it back ordered', () => {
    const id = createPost(db, {
      title: 'Launch',
      idea: 'announce the launch',
      image_path: 'abc.jpg',
      variants: [
        { platform: 'facebook', content: 'fb text', enabled: true },
        { platform: 'x', content: 'x text', enabled: true },
      ],
    });
    const post = getPostById(db, id);
    expect(post).toBeDefined();
    expect(post!.title).toBe('Launch');
    expect(post!.image_path).toBe('abc.jpg');
    expect(post!.status).toBe('draft');
    // ordered by PLATFORM_ORDER: x before facebook
    expect(post!.variants.map((v) => v.platform)).toEqual(['x', 'facebook']);
    expect(post!.variants[0].content).toBe('x text');
    expect(post!.variants[0].enabled).toBe(1);
  });

  it('returns undefined for a missing id', () => {
    expect(getPostById(db, 999)).toBeUndefined();
  });
});

describe('listPosts', () => {
  it('lists posts newest first with enabled platforms', () => {
    createPost(db, { title: 'A', variants: [{ platform: 'x', content: '', enabled: true }] });
    createPost(db, {
      title: 'B',
      variants: [
        { platform: 'x', content: '', enabled: true },
        { platform: 'linkedin', content: '', enabled: true },
      ],
    });
    const list = listPosts(db);
    expect(list).toHaveLength(2);
    expect(list[0].title).toBe('B');
    expect(list[0].platforms).toEqual(['x', 'linkedin']);
  });

  it('filters by status', () => {
    const id = createPost(db, { title: 'A', variants: [{ platform: 'x', content: '', enabled: true }] });
    updatePost(db, id, { status: 'archived' });
    expect(listPosts(db, 'archived')).toHaveLength(1);
    expect(listPosts(db, 'draft')).toHaveLength(0);
    expect(listPosts(db, 'all')).toHaveLength(1);
  });
});

describe('updatePost / deletePost', () => {
  it('updates post-level fields', () => {
    const id = createPost(db, { title: 'A', variants: [{ platform: 'x', content: '', enabled: true }] });
    updatePost(db, id, { title: 'A2', idea: 'new idea', scheduled_at: '2026-06-01', status: 'scheduled' });
    const post = getPostById(db, id)!;
    expect(post.title).toBe('A2');
    expect(post.idea).toBe('new idea');
    expect(post.scheduled_at).toBe('2026-06-01');
    expect(post.status).toBe('scheduled');
  });

  it('deletes a post', () => {
    const id = createPost(db, { title: 'A', variants: [{ platform: 'x', content: '', enabled: true }] });
    deletePost(db, id);
    expect(getPostById(db, id)).toBeUndefined();
  });
});
