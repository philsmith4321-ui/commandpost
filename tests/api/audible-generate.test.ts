import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({ getDb: () => ({}) }));
vi.mock('@/lib/rag/retrieve', () => ({ retrieveContext: vi.fn() }));
vi.mock('@/lib/generation/generate', () => ({ generateContent: vi.fn() }));
vi.mock('@/lib/queries/generation-queries', () => ({ createGeneration: vi.fn().mockReturnValue(42) }));
vi.mock('@/lib/queries/kb-queries', () => ({ listAudibleKbDocuments: vi.fn() }));
// Defensive Buffer isolation: the audible route must never touch Buffer drafting.
vi.mock('@/lib/buffer/draft', () => ({ draftGenerationToBuffer: vi.fn() }));

import { retrieveContext } from '@/lib/rag/retrieve';
import { generateContent } from '@/lib/generation/generate';
import { createGeneration } from '@/lib/queries/generation-queries';
import { listAudibleKbDocuments } from '@/lib/queries/kb-queries';
import { draftGenerationToBuffer } from '@/lib/buffer/draft';
import { POST } from '@/app/api/audible/generate/route';

function req(body: unknown) {
  return new NextRequest(new Request('http://localhost/api/audible/generate', {
    method: 'POST', body: JSON.stringify(body),
  }));
}

const DOCS = [
  { id: 11, title: 'Audible — Influence' },
  { id: 22, title: 'Audible — Negotiation' },
];

describe('POST /api/audible/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listAudibleKbDocuments).mockReturnValue(DOCS as never);
    vi.mocked(retrieveContext).mockResolvedValue({
      chunks: [{ text: 'chunk', doc_title: 'Audible — Influence', source_type: 'text', score: 1 }],
      mode: 'keyword',
    });
    vi.mocked(generateContent).mockResolvedValue({ ok: true, text: 'GENERATED' });
  });

  it('happy path: two categories → 200, persisted kind=audible with resolved doc ids', async () => {
    const res = await POST(req({
      contentType: 'blog_article', topic: 'reciprocity', length: 'medium',
      categories: ['Influence', 'Negotiation'],
    }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.id).toBe(42);
    expect(body.result).toBe('GENERATED');
    expect(body.sources_used).toBeGreaterThan(0);
    expect(body).not.toHaveProperty('buffer');
    expect(createGeneration).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      kind: 'audible',
      source_ids: [11, 22],
      content_type: 'blog_article',
      topic: 'reciprocity',
      result: 'GENERATED',
    }));
  });

  it('empty categories → 400 (never ungrounded)', async () => {
    const res = await POST(req({ contentType: 'blog_article', topic: 'reciprocity', categories: [] }));
    expect(res.status).toBe(400);
    expect(retrieveContext).not.toHaveBeenCalled();
  });

  it('missing categories field → 400', async () => {
    const res = await POST(req({ contentType: 'blog_article', topic: 'reciprocity' }));
    expect(res.status).toBe(400);
  });

  it('unknown category name → 400 naming the unknown categories', async () => {
    const res = await POST(req({
      contentType: 'blog_article', topic: 'reciprocity',
      categories: ['Influence', 'Astrology'],
    }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain('Astrology');
    expect(retrieveContext).not.toHaveBeenCalled();
    expect(createGeneration).not.toHaveBeenCalled();
  });

  it('invalid contentType → 400', async () => {
    const res = await POST(req({ contentType: 'nope', topic: 'reciprocity', categories: ['Influence'] }));
    expect(res.status).toBe(400);
  });

  it('empty topic → 400', async () => {
    const res = await POST(req({ contentType: 'blog_article', topic: '   ', categories: ['Influence'] }));
    expect(res.status).toBe(400);
  });

  it('resolves categories by name against the current audible doc list, not client ids (AE1)', async () => {
    // Simulate re-sync id churn: same titles, new ids.
    vi.mocked(listAudibleKbDocuments).mockReturnValue([
      { id: 911, title: 'Audible — Influence' },
    ] as never);
    const res = await POST(req({
      contentType: 'blog_article', topic: 'reciprocity', categories: ['Influence'],
      // A hostile/stale client-supplied ids field must be ignored entirely.
      sourceIds: [1, 2, 3],
    }));
    expect(res.status).toBe(200);
    expect(retrieveContext).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ sourceIds: [911] }));
    expect(createGeneration).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ source_ids: [911] }));
  });

  it('KTD9: one retrieval call per category with split k; chunks from both docs reach generateContent', async () => {
    const chunkA = { text: 'from influence', doc_title: 'Audible — Influence', source_type: 'text', score: 2 };
    const chunkB = { text: 'from negotiation', doc_title: 'Audible — Negotiation', source_type: 'text', score: 0 };
    vi.mocked(retrieveContext).mockImplementation(async (_db, opts) => {
      if (opts.sourceIds[0] === 11) return { chunks: [chunkA], mode: 'keyword' };
      return { chunks: [chunkB], mode: 'keyword' }; // no keyword overlap, still contributes
    });
    const res = await POST(req({
      contentType: 'blog_article', topic: 'reciprocity',
      categories: ['Influence', 'Negotiation'],
    }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(retrieveContext).toHaveBeenCalledTimes(2);
    // k = Math.max(3, Math.ceil(12 / 2)) = 6
    expect(retrieveContext).toHaveBeenNthCalledWith(
      1, expect.anything(), expect.objectContaining({ topic: 'reciprocity', sourceIds: [11], k: 6 })
    );
    expect(retrieveContext).toHaveBeenNthCalledWith(
      2, expect.anything(), expect.objectContaining({ topic: 'reciprocity', sourceIds: [22], k: 6 })
    );
    // The same cache object is threaded through every call so the topic is embedded at most once.
    const calls = vi.mocked(retrieveContext).mock.calls;
    expect(calls[0][1].queryVectorCache).toBeDefined();
    expect(calls[1][1].queryVectorCache).toBe(calls[0][1].queryVectorCache);
    expect(generateContent).toHaveBeenCalledWith(expect.objectContaining({
      chunks: [chunkA, chunkB],
      audience: undefined,
    }));
    expect(body.sources_used).toBe(2);
  });

  it('reports vector mode only when all per-category calls are vector', async () => {
    vi.mocked(retrieveContext)
      .mockResolvedValueOnce({ chunks: [], mode: 'vector' })
      .mockResolvedValueOnce({ chunks: [], mode: 'vector' });
    let res = await POST(req({ contentType: 'blog_article', topic: 't', categories: ['Influence', 'Negotiation'] }));
    expect((await res.json()).retrieval_mode).toBe('vector');

    vi.mocked(retrieveContext)
      .mockResolvedValueOnce({ chunks: [], mode: 'vector' })
      .mockResolvedValueOnce({ chunks: [], mode: 'keyword' });
    res = await POST(req({ contentType: 'blog_article', topic: 't', categories: ['Influence', 'Negotiation'] }));
    expect((await res.json()).retrieval_mode).toBe('keyword');
  });

  it('never touches Buffer drafting', async () => {
    await POST(req({ contentType: 'social_twitter', topic: 'reciprocity', categories: ['Influence'] }));
    expect(draftGenerationToBuffer).not.toHaveBeenCalled();
  });

  it('generateContent failure → 502 and nothing persisted', async () => {
    vi.mocked(generateContent).mockResolvedValue({ ok: false, error: 'AI down' });
    const res = await POST(req({ contentType: 'blog_article', topic: 'reciprocity', categories: ['Influence'] }));
    const body = await res.json();
    expect(res.status).toBe(502);
    expect(body.error).toBe('AI down');
    expect(createGeneration).not.toHaveBeenCalled();
  });
});
