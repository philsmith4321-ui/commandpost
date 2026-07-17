/**
 * Route-level fence tests: /generate endpoints must never see Audible docs or
 * Audible generations, even via crafted API input. Real in-memory DB; only the
 * LLM/Buffer/embedding edges are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { initDb } from '@/lib/db';
import { createKbDocument, replaceChunks } from '@/lib/queries/kb-queries';
import { createGeneration } from '@/lib/queries/generation-queries';
import { AUDIBLE_DOC_SET } from '@/lib/audible';
import type Database from 'better-sqlite3';

let testDb: Database.Database;

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getDb: () => testDb };
});
vi.mock('@/lib/generation/generate', () => ({ generateContent: vi.fn() }));
vi.mock('@/lib/buffer/draft', () => ({ draftGenerationToBuffer: vi.fn() }));
vi.mock('@/lib/buffer/client', () => ({ isBufferConfigured: vi.fn() }));
vi.mock('@/lib/rag/embed', () => ({ isVoyageConfigured: () => false, embedQuery: vi.fn() }));

import { generateContent } from '@/lib/generation/generate';
import { draftGenerationToBuffer } from '@/lib/buffer/draft';
import { isBufferConfigured } from '@/lib/buffer/client';
import { POST as generatePost } from '@/app/api/generate/route';
import { GET as historyGet } from '@/app/api/generate/history/route';
import { GET as getById, DELETE as deleteById } from '@/app/api/generate/[id]/route';
import { POST as backfillPost } from '@/app/api/generate/backfill-buffer/route';

beforeEach(() => {
  vi.clearAllMocks();
  testDb = initDb(':memory:');
});

function seedDoc(title: string, text: string, doc_set?: string) {
  const id = createKbDocument(testDb, {
    title,
    source_type: 'text',
    content: text,
    ...(doc_set ? { doc_set } : {}),
  });
  replaceChunks(testDb, id, [text]);
  return id;
}

function seedGeneration(kind?: 'generate' | 'audible', content_type: 'blog_article' | 'social_twitter' = 'blog_article') {
  return createGeneration(testDb, {
    content_type,
    topic: 't',
    length: 'medium',
    source_ids: [],
    retrieval_mode: 'none',
    result: 'body',
    ...(kind ? { kind } : {}),
  });
}

function req(body: unknown) {
  return new NextRequest(new Request('http://localhost/api/generate', {
    method: 'POST', body: JSON.stringify(body),
  }));
}

function params(id: number) {
  return { params: Promise.resolve({ id: String(id) }) };
}

function generationsCount() {
  return (testDb.prepare('SELECT COUNT(*) as n FROM generations').get() as { n: number }).n;
}

describe('POST /api/generate sourceIds fence', () => {
  it("400s on the Audible-only 'prompt' content type; nothing generated or persisted", async () => {
    const res = await generatePost(req({ contentType: 'prompt', topic: 'what does this say about trust?' }));
    expect(res.status).toBe(400);
    expect(generateContent).not.toHaveBeenCalled();
    expect(generationsCount()).toBe(0);
  });

  it('400s when any sourceId is an Audible doc; nothing generated, persisted, or drafted', async () => {
    const general = seedDoc('General doc', 'general text');
    const audible = seedDoc('Audible — Influence', 'secret notes', AUDIBLE_DOC_SET);

    const res = await generatePost(req({
      contentType: 'social_twitter', topic: 'growth', sourceIds: [general, audible],
    }));

    expect(res.status).toBe(400);
    expect(generateContent).not.toHaveBeenCalled();
    expect(draftGenerationToBuffer).not.toHaveBeenCalled();
    expect(generationsCount()).toBe(0);
  });

  it('200s with only non-Audible sourceIds, stores kind=generate, still auto-drafts social to Buffer', async () => {
    const general = seedDoc('General doc', 'growth tactics for small business');
    seedDoc('Audible — Influence', 'secret notes', AUDIBLE_DOC_SET); // present but unselected

    vi.mocked(generateContent).mockResolvedValue({ ok: true, text: 'OUT' });
    vi.mocked(draftGenerationToBuffer).mockResolvedValue({ pushed: true, postId: 'bp_1', channel: 'X' });

    const res = await generatePost(req({
      contentType: 'social_twitter', topic: 'growth', sourceIds: [general],
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.buffer).toEqual({ pushed: true, channel: 'X' });
    expect(draftGenerationToBuffer).toHaveBeenCalledWith('social_twitter', 'OUT');

    const row = testDb.prepare('SELECT kind, buffer_post_id FROM generations WHERE id = ?').get(body.id) as
      { kind: string; buffer_post_id: string | null };
    expect(row.kind).toBe('generate');
    expect(row.buffer_post_id).toBe('bp_1');
  });
});

describe('GET /api/generate/history fence', () => {
  it('returns only kind=generate rows', async () => {
    const keep = seedGeneration();
    seedGeneration('audible');

    const res = await historyGet();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.generations.map((g: { id: number }) => g.id)).toEqual([keep]);
  });
});

describe('/api/generate/[id] fence', () => {
  it('GET 404s on an Audible row, 200s on a generate row', async () => {
    const gen = seedGeneration();
    const aud = seedGeneration('audible');

    expect((await getById({} as NextRequest, params(aud))).status).toBe(404);

    const ok = await getById({} as NextRequest, params(gen));
    expect(ok.status).toBe(200);
    expect((await ok.json()).id).toBe(gen);
  });

  it('DELETE 404s on an Audible row without deleting it; deletes a generate row', async () => {
    const gen = seedGeneration();
    const aud = seedGeneration('audible');

    const resAud = await deleteById({} as NextRequest, params(aud));
    expect(resAud.status).toBe(404);
    expect(generationsCount()).toBe(2); // audible row untouched

    const resGen = await deleteById({} as NextRequest, params(gen));
    expect(resGen.status).toBe(200);
    expect(generationsCount()).toBe(1);
  });
});

describe('POST /api/generate/backfill-buffer fence', () => {
  it('never sweeps an unpushed Audible social row', async () => {
    const gen = seedGeneration(undefined, 'social_twitter');
    const aud = seedGeneration('audible', 'social_twitter');

    vi.mocked(isBufferConfigured).mockReturnValue(true);
    vi.mocked(draftGenerationToBuffer).mockResolvedValue({ pushed: true, postId: 'bp_2', channel: 'X' });

    const res = await backfillPost();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ pushed: 1, skipped: 0, failed: 0 });
    expect(draftGenerationToBuffer).toHaveBeenCalledTimes(1);

    const rows = testDb.prepare('SELECT id, buffer_post_id FROM generations ORDER BY id').all() as
      { id: number; buffer_post_id: string | null }[];
    expect(rows.find((r) => r.id === gen)!.buffer_post_id).toBe('bp_2');
    expect(rows.find((r) => r.id === aud)!.buffer_post_id).toBeNull();
  });
});
