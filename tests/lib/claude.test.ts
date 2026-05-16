import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('claude utility', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it('isClaudeConfigured returns false when env var missing', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { isClaudeConfigured } = await import('@/lib/claude');
    expect(isClaudeConfigured()).toBe(false);
  });

  it('isClaudeConfigured returns true when env var set', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    const { isClaudeConfigured } = await import('@/lib/claude');
    expect(isClaudeConfigured()).toBe(true);
  });

  it('askClaude calls Anthropic API with correct params', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        content: [{ type: 'text', text: 'Hello from Claude' }],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { askClaude } = await import('@/lib/claude');
    const result = await askClaude('You are helpful.', 'Say hello');

    expect(result).toBe('Hello from Claude');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(options.method).toBe('POST');
    expect(options.headers['x-api-key']).toBe('sk-ant-test');
    expect(options.headers['anthropic-version']).toBe('2023-06-01');

    const body = JSON.parse(options.body);
    expect(body.model).toBe('claude-sonnet-4-20250514');
    expect(body.max_tokens).toBe(1024);
    expect(body.system).toBe('You are helpful.');
    expect(body.messages[0].content).toBe('Say hello');
  });

  it('askClaude returns null on API failure', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { askClaude } = await import('@/lib/claude');
    const result = await askClaude('system', 'user');

    expect(result).toBeNull();
  });

  it('askClaude respects custom maxTokens', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        content: [{ type: 'text', text: 'Short' }],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { askClaude } = await import('@/lib/claude');
    await askClaude('system', 'user', 200);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.max_tokens).toBe(200);
  });
});
