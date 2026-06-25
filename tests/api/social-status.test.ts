import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/buffer/client', () => ({ isBufferConfigured: vi.fn(), bufferOrgId: () => 'org-123' }));
vi.mock('@/lib/buffer/queries', () => ({ listChannels: vi.fn() }));

import { isBufferConfigured } from '@/lib/buffer/client';
import { listChannels } from '@/lib/buffer/queries';
import { GET } from '@/app/api/social/status/route';

describe('GET /api/social/status', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns configured:false with no channels when key missing', async () => {
    vi.mocked(isBufferConfigured).mockReturnValue(false);
    const res = await GET();
    const body = await res.json();
    expect(body).toEqual({ configured: false, orgId: null, channels: [] });
    expect(listChannels).not.toHaveBeenCalled();
  });

  it('returns channels when configured', async () => {
    vi.mocked(isBufferConfigured).mockReturnValue(true);
    vi.mocked(listChannels).mockResolvedValue([
      { id: 'c1', service: 'twitter', name: 'X', platform: 'x' },
    ]);
    const res = await GET();
    const body = await res.json();
    expect(body.configured).toBe(true);
    expect(body.channels).toHaveLength(1);
  });
});
