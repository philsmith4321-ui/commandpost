import { describe, it, expect, beforeEach } from 'vitest';
import { initDb } from '@/lib/db';
import {
  createGeneration,
  getGeneration,
  setGenerationBufferPostId,
  listUnpushedSocialGenerations,
} from '@/lib/queries/generation-queries';
import type Database from 'better-sqlite3';

let db: Database.Database;
beforeEach(() => { db = initDb(':memory:'); });

function mk(content_type: 'social_twitter' | 'blog_article', topic = 't') {
  return createGeneration(db, {
    content_type, topic, length: 'medium', source_ids: [], retrieval_mode: 'none', result: 'body',
  });
}

describe('generation buffer_post_id', () => {
  it('defaults buffer_post_id to null and sets it', () => {
    const id = mk('social_twitter');
    expect(getGeneration(db, id)!.buffer_post_id).toBeNull();
    setGenerationBufferPostId(db, id, 'bp_1');
    expect(getGeneration(db, id)!.buffer_post_id).toBe('bp_1');
  });

  it('listUnpushedSocialGenerations returns only unpushed social rows', () => {
    const social = mk('social_twitter');
    mk('blog_article');                 // non-social → excluded
    const pushed = mk('social_twitter');
    setGenerationBufferPostId(db, pushed, 'bp_2');
    const rows = listUnpushedSocialGenerations(db);
    expect(rows.map((r) => r.id)).toEqual([social]);
  });
});
