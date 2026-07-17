import { describe, it, expect, beforeEach } from 'vitest';
import { initDb } from '@/lib/db';
import {
  createGeneration,
  getGeneration,
  listGenerations,
  setGenerationBufferPostId,
  listUnpushedSocialGenerations,
} from '@/lib/queries/generation-queries';
import type { GenerationKind } from '@/lib/types';
import type Database from 'better-sqlite3';

let db: Database.Database;
beforeEach(() => { db = initDb(':memory:'); });

function mk(content_type: 'social_twitter' | 'blog_article', topic = 't', kind?: GenerationKind) {
  return createGeneration(db, {
    content_type, topic, length: 'medium', source_ids: [], retrieval_mode: 'none', result: 'body',
    ...(kind ? { kind } : {}),
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

describe('generation kind segregation', () => {
  it('migration adds kind column defaulting to generate for raw inserts', () => {
    const col = db
      .prepare("SELECT COUNT(*) as count FROM pragma_table_info('generations') WHERE name = 'kind'")
      .get() as { count: number };
    expect(col.count).toBe(1);
    db.prepare(
      "INSERT INTO generations (content_type, topic, length, retrieval_mode, result) VALUES ('blog_article','t','medium','none','r')"
    ).run();
    const row = db.prepare('SELECT kind FROM generations').get() as { kind: string };
    expect(row.kind).toBe('generate');
  });

  it('createGeneration defaults kind to generate and round-trips audible', () => {
    const genId = mk('blog_article');
    expect(getGeneration(db, genId)!.kind).toBe('generate');
    const audId = mk('blog_article', 't', 'audible');
    expect(getGeneration(db, audId, 'audible')!.kind).toBe('audible');
    // get-by-id is kind-fenced: the default (generate) lookup must not see audible rows
    expect(getGeneration(db, audId)).toBeUndefined();
  });

  it('listGenerations filters by kind and defaults to generate', () => {
    const genId = mk('blog_article');
    const audId = mk('blog_article', 't', 'audible');
    expect(listGenerations(db).map((r) => r.id)).toEqual([genId]);
    expect(listGenerations(db, 'audible').map((r) => r.id)).toEqual([audId]);
  });

  it('listUnpushedSocialGenerations never returns audible rows', () => {
    const social = mk('social_twitter');
    // audible + social content type + buffer_post_id NULL: still fenced out
    mk('social_twitter', 't', 'audible');
    expect(listUnpushedSocialGenerations(db).map((r) => r.id)).toEqual([social]);
  });
});
