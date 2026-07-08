import { describe, it, expect, vi, afterEach } from 'vitest';
import { askClaudeWithWebSearch } from '@/lib/claude';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('askClaudeWithWebSearch', () => {
  it('sends the web_search tool and joins all answer text blocks after the last tool block', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    let sentBody: Record<string, unknown> | null = null;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      sentBody = JSON.parse(init.body as string);
      return {
        ok: true,
        json: async () => ({
          content: [
            { type: 'text', text: "I'll search for this business." },
            { type: 'server_tool_use', id: 'x', name: 'web_search', input: {} },
            { type: 'web_search_tool_result', tool_use_id: 'x', content: [] },
            // Citation-bearing answers arrive split across several text blocks.
            { type: 'text', text: '- Fact one ' },
            { type: 'text', text: '(https://example.com)' },
            { type: 'text', text: '\n- Fact two (https://example.org)' },
          ],
        }),
      };
    }));

    const out = await askClaudeWithWebSearch('sys', 'user msg', 1024);
    expect(out).toBe('- Fact one (https://example.com)\n- Fact two (https://example.org)');
    const tools = (sentBody as unknown as { tools: Array<{ type: string; max_uses: number }> }).tools;
    expect(tools[0].type).toBe('web_search_20260209');
    expect(tools[0].max_uses).toBe(5);
  });

  it('returns null on API error', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, text: async () => 'boom' })));
    expect(await askClaudeWithWebSearch('sys', 'user')).toBeNull();
  });
});
