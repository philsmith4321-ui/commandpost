import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({ getDb: () => ({}) }));
vi.mock('@/lib/buffer/client', () => ({ isBufferConfigured: vi.fn() }));
vi.mock('@/lib/queries/generation-queries', () => ({
  listUnpushedSocialGenerations: vi.fn(),
  setGenerationBufferPostId: vi.fn(),
}));
vi.mock('@/lib/buffer/draft', () => ({ draftGenerationToBuffer: vi.fn() }));

import { isBufferConfigured } from '@/lib/buffer/client';
import { listUnpushedSocialGenerations, setGenerationBufferPostId } from '@/lib/queries/generation-queries';
import { draftGenerationToBuffer } from '@/lib/buffer/draft';
import { POST } from '@/app/api/generate/backfill-buffer/route';

describe('POST /api/generate/backfill-buffer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('400s when Buffer is not configured', async () => {
    vi.mocked(isBufferConfigured).mockReturnValue(false);
    const res = await POST();
    expect(res.status).toBe(400);
    expect(listUnpushedSocialGenerations).not.toHaveBeenCalled();
  });

  it('pushes eligible generations and tallies pushed/skipped/failed', async () => {
    vi.mocked(isBufferConfigured).mockReturnValue(true);
    vi.mocked(listUnpushedSocialGenerations).mockReturnValue([
      { id: 1, content_type: 'social_twitter', result: 'a' },
      { id: 2, content_type: 'social_facebook', result: 'b' },
      { id: 3, content_type: 'social_linkedin', result: 'c' },
    ] as never);
    vi.mocked(draftGenerationToBuffer)
      .mockResolvedValueOnce({ pushed: true, postId: 'bp1', channel: 'X' })
      .mockResolvedValueOnce({ pushed: false, reason: 'no_channel' })
      .mockResolvedValueOnce({ pushed: false, reason: 'error', message: 'boom' });
    const res = await POST();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ pushed: 1, skipped: 1, failed: 1 });
    expect(setGenerationBufferPostId).toHaveBeenCalledTimes(1);
    expect(setGenerationBufferPostId).toHaveBeenCalledWith(expect.anything(), 1, 'bp1');
  });
});
