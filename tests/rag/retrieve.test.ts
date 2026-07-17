import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initDb } from '@/lib/db';
import { createKbDocument, replaceChunks, chunksForDocuments, setChunkEmbedding } from '@/lib/queries/kb-queries';
import { retrieveContext } from '@/lib/rag/retrieve';
import { isVoyageConfigured, embedQuery } from '@/lib/rag/embed';
import type Database from 'better-sqlite3';

vi.mock('@/lib/rag/embed', () => ({
  isVoyageConfigured: vi.fn(() => true),
  embedQuery: vi.fn(async () => [1, 0, 0]),
}));

let db: Database.Database;

function seedEmbeddedDoc(title: string): number {
  const id = createKbDocument(db, { title, source_type: 'text', content: 'body' });
  replaceChunks(db, id, ['alpha chunk text', 'beta chunk text']);
  for (const c of chunksForDocuments(db, [id])) {
    setChunkEmbedding(db, c.id, [1, 0, 0]);
  }
  return id;
}

beforeEach(() => {
  db = initDb(':memory:');
  vi.mocked(isVoyageConfigured).mockReturnValue(true);
  vi.mocked(embedQuery).mockClear();
  vi.mocked(embedQuery).mockResolvedValue([1, 0, 0]);
});

describe('retrieveContext queryVectorCache', () => {
  it('embeds the topic once when the same cache object is shared across calls', async () => {
    const a = seedEmbeddedDoc('Doc A');
    const b = seedEmbeddedDoc('Doc B');
    const queryVectorCache = {};
    const r1 = await retrieveContext(db, { topic: 'alpha', sourceIds: [a], k: 2, queryVectorCache });
    const r2 = await retrieveContext(db, { topic: 'alpha', sourceIds: [b], k: 2, queryVectorCache });
    expect(r1.mode).toBe('vector');
    expect(r2.mode).toBe('vector');
    expect(r1.chunks.length).toBeGreaterThan(0);
    expect(r2.chunks.length).toBeGreaterThan(0);
    expect(embedQuery).toHaveBeenCalledTimes(1);
  });

  it('embeds per call when no cache object is passed (existing behavior preserved)', async () => {
    const a = seedEmbeddedDoc('Doc A');
    await retrieveContext(db, { topic: 'alpha', sourceIds: [a], k: 2 });
    await retrieveContext(db, { topic: 'alpha', sourceIds: [a], k: 2 });
    expect(embedQuery).toHaveBeenCalledTimes(2);
  });

  it('caches a null embedding result and falls back to keyword without re-embedding', async () => {
    vi.mocked(embedQuery).mockResolvedValue(null);
    const a = seedEmbeddedDoc('Doc A');
    const b = seedEmbeddedDoc('Doc B');
    const queryVectorCache = {};
    const r1 = await retrieveContext(db, { topic: 'alpha', sourceIds: [a], k: 2, queryVectorCache });
    const r2 = await retrieveContext(db, { topic: 'alpha', sourceIds: [b], k: 2, queryVectorCache });
    expect(r1.mode).toBe('keyword');
    expect(r2.mode).toBe('keyword');
    expect(embedQuery).toHaveBeenCalledTimes(1);
  });

  it('does not call embedQuery at all when no chunks are embedded (no wasted API call)', async () => {
    const id = createKbDocument(db, { title: 'Doc C', source_type: 'text', content: 'body' });
    replaceChunks(db, id, ['gamma chunk text']);
    const queryVectorCache = {};
    const r = await retrieveContext(db, { topic: 'gamma', sourceIds: [id], k: 2, queryVectorCache });
    expect(r.mode).toBe('keyword');
    expect(embedQuery).not.toHaveBeenCalled();
  });
});
