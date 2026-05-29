import { describe, it, expect, beforeEach } from 'vitest';
import { initDb } from '@/lib/db';
import type Database from 'better-sqlite3';

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
