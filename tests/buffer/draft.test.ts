import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/buffer/client', () => ({ isBufferConfigured: vi.fn() }));
vi.mock('@/lib/buffer/queries', () => ({ listChannels: vi.fn(), createPost: vi.fn() }));

import { isBufferConfigured } from '@/lib/buffer/client';
import { listChannels, createPost } from '@/lib/buffer/queries';
import { draftGenerationToBuffer } from '@/lib/buffer/draft';

const CHANNELS = [
  { id: 'li', service: 'linkedin', name: 'LI', platform: 'linkedin' },
  { id: 'tw', service: 'twitter', name: 'X acct', platform: 'x' },
];

describe('draftGenerationToBuffer', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns not_social for non-social content', async () => {
    const r = await draftGenerationToBuffer('blog_article', 'hello');
    expect(r).toEqual({ pushed: false, reason: 'not_social' });
    expect(createPost).not.toHaveBeenCalled();
  });

  it('returns not_configured when Buffer is off', async () => {
    vi.mocked(isBufferConfigured).mockReturnValue(false);
    const r = await draftGenerationToBuffer('social_twitter', 'hi');
    expect(r).toEqual({ pushed: false, reason: 'not_configured' });
  });

  it('returns no_channel when target platform is not connected', async () => {
    vi.mocked(isBufferConfigured).mockReturnValue(true);
    vi.mocked(listChannels).mockResolvedValue(CHANNELS as never);
    const r = await draftGenerationToBuffer('social_facebook', 'hi'); // no facebook channel
    expect(r).toEqual({ pushed: false, reason: 'no_channel' });
  });

  it('creates a draft on the matching channel and returns pushed', async () => {
    vi.mocked(isBufferConfigured).mockReturnValue(true);
    vi.mocked(listChannels).mockResolvedValue(CHANNELS as never);
    vi.mocked(createPost).mockResolvedValue({ id: 'p9' } as never);
    const r = await draftGenerationToBuffer('social_twitter', 'hi');
    expect(r).toEqual({ pushed: true, postId: 'p9', channel: 'X acct' });
    expect(createPost).toHaveBeenCalledWith({ channelId: 'tw', text: 'hi', mode: 'addToQueue', saveToDraft: true });
  });

  it('returns error (non-throwing) when Buffer call fails', async () => {
    vi.mocked(isBufferConfigured).mockReturnValue(true);
    vi.mocked(listChannels).mockRejectedValue(new Error('boom'));
    const r = await draftGenerationToBuffer('social_linkedin', 'hi');
    expect(r).toMatchObject({ pushed: false, reason: 'error' });
  });
});
