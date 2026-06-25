import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/buffer/queries', () => ({ listPosts: vi.fn(), createPost: vi.fn() }));
import { listPosts, createPost } from '@/lib/buffer/queries';
import { GET, POST } from '@/app/api/social/posts/route';

function req(url: string, init?: RequestInit) {
  return new NextRequest(new Request(url, init));
}

describe('/api/social/posts', () => {
  beforeEach(() => vi.resetAllMocks());

  it('GET returns the queue', async () => {
    vi.mocked(listPosts).mockResolvedValue([{ id: 'p1' } as never]);
    const res = await GET(req('http://localhost/api/social/posts'));
    expect(await res.json()).toEqual({ posts: [{ id: 'p1' }] });
  });

  it('GET passes status + channelId filters', async () => {
    vi.mocked(listPosts).mockResolvedValue([]);
    await GET(req('http://localhost/api/social/posts?status=scheduled&channelId=c1'));
    expect(listPosts).toHaveBeenCalledWith({ status: ['scheduled'], channelIds: ['c1'] });
  });

  it('POST 400s when channelIds empty', async () => {
    const res = await POST(req('http://localhost/api/social/posts', {
      method: 'POST', body: JSON.stringify({ channelIds: [], text: 'hi', mode: 'addToQueue' }),
    }));
    expect(res.status).toBe(400);
    expect(createPost).not.toHaveBeenCalled();
  });

  it('POST fans out one createPost per channel', async () => {
    vi.mocked(createPost).mockResolvedValue({ id: 'p1' } as never);
    const res = await POST(req('http://localhost/api/social/posts', {
      method: 'POST', body: JSON.stringify({ channelIds: ['c1', 'c2'], text: 'hi', mode: 'addToQueue' }),
    }));
    const body = await res.json();
    expect(createPost).toHaveBeenCalledTimes(2);
    expect(body.created).toHaveLength(2);
  });

  it('POST 400s when customScheduled without dueAt', async () => {
    const res = await POST(req('http://localhost/api/social/posts', {
      method: 'POST', body: JSON.stringify({ channelIds: ['c1'], text: 'hi', mode: 'customScheduled' }),
    }));
    expect(res.status).toBe(400);
  });
});
