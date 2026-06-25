import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/buffer/queries', () => ({ editPost: vi.fn(), deletePost: vi.fn() }));
import { editPost, deletePost } from '@/lib/buffer/queries';
import { PATCH, DELETE } from '@/app/api/social/posts/[id]/route';

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
function req(method: string, body?: unknown) {
  return new NextRequest(new Request('http://localhost/api/social/posts/p1', {
    method, ...(body ? { body: JSON.stringify(body) } : {}),
  }));
}

describe('/api/social/posts/[id]', () => {
  beforeEach(() => vi.resetAllMocks());

  it('PATCH reschedules via editPost', async () => {
    vi.mocked(editPost).mockResolvedValue({ id: 'p1' } as never);
    const res = await PATCH(req('PATCH', { mode: 'customScheduled', dueAt: '2026-12-01T17:00:00.000Z' }), ctx('p1'));
    expect(res.status).toBe(200);
    expect(editPost).toHaveBeenCalledWith({ id: 'p1', mode: 'customScheduled', dueAt: '2026-12-01T17:00:00.000Z', text: undefined });
  });

  it('PATCH 400s on invalid mode', async () => {
    const res = await PATCH(req('PATCH', { mode: 'nope' }), ctx('p1'));
    expect(res.status).toBe(400);
  });

  it('DELETE removes the post', async () => {
    vi.mocked(deletePost).mockResolvedValue('p1');
    const res = await DELETE(req('DELETE'), ctx('p1'));
    expect(res.status).toBe(200);
    expect(deletePost).toHaveBeenCalledWith('p1');
  });
});
