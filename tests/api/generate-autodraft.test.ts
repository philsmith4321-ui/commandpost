import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({ getDb: () => ({}) }));
vi.mock('@/lib/rag/retrieve', () => ({ retrieveContext: vi.fn().mockResolvedValue({ chunks: [], mode: 'none' }) }));
vi.mock('@/lib/generation/generate', () => ({ generateContent: vi.fn().mockResolvedValue({ ok: true, text: 'GENERATED' }) }));
vi.mock('@/lib/queries/master-queries', () => ({ getMasterProfile: () => null }));
vi.mock('@/lib/queries/avatar-queries', () => ({ getAvatar: vi.fn(), listAvatars: vi.fn().mockReturnValue([]) }));
vi.mock('@/lib/generation/audience', () => ({ composeAudience: () => undefined }));
vi.mock('@/lib/queries/generation-queries', () => ({ createGeneration: vi.fn().mockReturnValue(42), setGenerationBufferPostId: vi.fn() }));
vi.mock('@/lib/buffer/draft', () => ({ draftGenerationToBuffer: vi.fn() }));

import { setGenerationBufferPostId } from '@/lib/queries/generation-queries';
import { draftGenerationToBuffer } from '@/lib/buffer/draft';
import { POST } from '@/app/api/generate/route';

function req(body: unknown) {
  return new NextRequest(new Request('http://localhost/api/generate', {
    method: 'POST', body: JSON.stringify(body),
  }));
}

describe('POST /api/generate auto-draft', () => {
  beforeEach(() => vi.clearAllMocks());

  it('records buffer_post_id and returns buffer:{pushed} for a social generation', async () => {
    vi.mocked(draftGenerationToBuffer).mockResolvedValue({ pushed: true, postId: 'bp_9', channel: 'X acct' });
    const res = await POST(req({ contentType: 'social_twitter', topic: 'hi' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(draftGenerationToBuffer).toHaveBeenCalledWith('social_twitter', 'GENERATED');
    expect(setGenerationBufferPostId).toHaveBeenCalledWith(expect.anything(), 42, 'bp_9');
    expect(body.buffer).toEqual({ pushed: true, channel: 'X acct' });
  });

  it('still returns 200 with buffer:{pushed:false} when the push is skipped/fails', async () => {
    vi.mocked(draftGenerationToBuffer).mockResolvedValue({ pushed: false, reason: 'no_channel' });
    const res = await POST(req({ contentType: 'social_facebook', topic: 'hi' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(setGenerationBufferPostId).not.toHaveBeenCalled();
    expect(body.buffer).toEqual({ pushed: false, reason: 'no_channel' });
  });
});
