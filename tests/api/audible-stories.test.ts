/**
 * Route tests for the Stories browse surface: POST /api/audible/stories/pull
 * (keyword best-match, random fallback, theme scoping, 404) and
 * GET /api/audible/story/[id] (story-fenced fetch).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({ getDb: () => ({}) }));
vi.mock('@/lib/queries/kb-queries', () => ({
  storyDocsForSearch: vi.fn(),
  randomStory: vi.fn(),
  getAudibleStory: vi.fn(),
}));

import { storyDocsForSearch, randomStory, getAudibleStory } from '@/lib/queries/kb-queries';
import { POST as pullPOST } from '@/app/api/audible/stories/pull/route';
import { GET as storyGET } from '@/app/api/audible/story/[id]/route';

function pullReq(body: unknown) {
  return new NextRequest(new Request('http://localhost/api/audible/stories/pull', {
    method: 'POST', body: JSON.stringify(body),
  }));
}

const TRUCK = {
  id: 1, title: 'Audible Story — The Old Truck',
  theme: 'Cars, trucks & driving', content: 'Dad bought a rusty truck and we fixed it together.',
};
const WEDDING = {
  id: 2, title: 'Audible Story — Our Wedding Day',
  theme: 'Marriage & Amy', content: 'Amy and I got married on a rainy Saturday.',
};

describe('POST /api/audible/stories/pull', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storyDocsForSearch).mockReturnValue([TRUCK, WEDDING] as never);
    vi.mocked(randomStory).mockReturnValue(TRUCK as never);
  });

  it('query with a keyword hit returns the best-scoring story, matched=true, prefix stripped', async () => {
    const res = await pullPOST(pullReq({ query: 'rainy wedding Saturday' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({
      id: 2, label: 'Our Wedding Day', theme: 'Marriage & Amy',
      content: WEDDING.content, matched: true,
    });
    expect(randomStory).not.toHaveBeenCalled();
  });

  it('query with zero keyword hits falls back to a random story, matched=false', async () => {
    const res = await pullPOST(pullReq({ query: 'zzz qqq xyzzy' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.matched).toBe(false);
    expect(body.label).toBe('The Old Truck');
    expect(randomStory).toHaveBeenCalled();
  });

  it('no query returns a random story, matched=false', async () => {
    const res = await pullPOST(pullReq({}));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({
      id: 1, label: 'The Old Truck', theme: 'Cars, trucks & driving',
      content: TRUCK.content, matched: false,
    });
    expect(storyDocsForSearch).not.toHaveBeenCalled();
  });

  it('valid theme is passed through to the queries; an unknown theme is treated as unscoped', async () => {
    await pullPOST(pullReq({ query: 'truck', theme: 'Cars, trucks & driving' }));
    expect(storyDocsForSearch).toHaveBeenCalledWith(expect.anything(), 'Cars, trucks & driving');

    await pullPOST(pullReq({ theme: 'Not A Theme' }));
    expect(randomStory).toHaveBeenCalledWith(expect.anything(), null);
  });

  it('404 when a query finds no candidate stories', async () => {
    vi.mocked(storyDocsForSearch).mockReturnValue([] as never);
    const res = await pullPOST(pullReq({ query: 'truck' }));
    expect(res.status).toBe(404);
  });

  it('404 when no query and no stories exist', async () => {
    vi.mocked(randomStory).mockReturnValue(undefined as never);
    const res = await pullPOST(pullReq({}));
    expect(res.status).toBe(404);
  });
});

describe('GET /api/audible/story/[id]', () => {
  const params = (id: string) => ({ params: Promise.resolve({ id }) });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAudibleStory).mockImplementation(
      (_db, id) => (id === 1 ? TRUCK : undefined) as never
    );
  });

  it('returns the story with its prefix-stripped label', async () => {
    const res = await storyGET({} as NextRequest, params('1'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({
      id: 1, label: 'The Old Truck', theme: 'Cars, trucks & driving', content: TRUCK.content,
    });
  });

  it('404 on a missing or non-story id (the IS_STORY fence)', async () => {
    expect((await storyGET({} as NextRequest, params('999'))).status).toBe(404);
    expect((await storyGET({} as NextRequest, params('abc'))).status).toBe(404);
  });
});
