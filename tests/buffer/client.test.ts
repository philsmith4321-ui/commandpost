import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('bufferGql client', () => {
  beforeEach(() => {
    vi.stubEnv('BUFFER_API_KEY', 'test-key');
    vi.stubEnv('BUFFER_ORG_ID', 'org-123');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('isBufferConfigured is true when both env vars set', async () => {
    const { isBufferConfigured } = await import('@/lib/buffer/client');
    expect(isBufferConfigured()).toBe(true);
  });

  it('posts query with bearer auth and returns data', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { ping: 'pong' } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { bufferGql } = await import('@/lib/buffer/client');
    const data = await bufferGql<{ ping: string }>('{ ping }');
    expect(data.ping).toBe('pong');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.buffer.com');
    expect(init.headers.Authorization).toBe('Bearer test-key');
  });

  it('throws BufferError when GraphQL returns errors[]', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ errors: [{ message: 'bad query' }] }),
    }));
    const { bufferGql, BufferError } = await import('@/lib/buffer/client');
    await expect(bufferGql('{ bad }')).rejects.toBeInstanceOf(BufferError);
  });
});
