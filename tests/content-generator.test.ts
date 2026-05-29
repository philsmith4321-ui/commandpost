import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/claude', () => ({
  isClaudeConfigured: () => true,
  askClaude: vi.fn(),
}));

import { askClaude } from '@/lib/claude';
import { parsePostVariants, buildSystemPrompt, generatePostVariants } from '@/lib/content-generator';

const SAMPLE = `===X===
Short x post #launch
===LINKEDIN===
A longer, professional LinkedIn update about the launch.
===FACEBOOK===
Friendly Facebook announcement.
===INSTAGRAM===
Caption with #hashtags`;

describe('parsePostVariants', () => {
  it('parses all requested platforms', () => {
    const result = parsePostVariants(SAMPLE, ['x', 'linkedin', 'facebook', 'instagram']);
    expect(result.x).toBe('Short x post #launch');
    expect(result.linkedin).toBe('A longer, professional LinkedIn update about the launch.');
    expect(result.facebook).toBe('Friendly Facebook announcement.');
    expect(result.instagram).toBe('Caption with #hashtags');
  });

  it('returns empty string for a requested platform missing from the response', () => {
    const text = `===X===\nonly x here`;
    const result = parsePostVariants(text, ['x', 'linkedin']);
    expect(result.x).toBe('only x here');
    expect(result.linkedin).toBe('');
  });

  it('only returns requested platforms, ignoring extra sections', () => {
    const result = parsePostVariants(SAMPLE, ['x']);
    expect(Object.keys(result)).toEqual(['x']);
    expect(result.x).toBe('Short x post #launch');
  });
});

describe('buildSystemPrompt', () => {
  it('includes the char limit for each requested platform', () => {
    const prompt = buildSystemPrompt(['x', 'linkedin'], 'casual');
    expect(prompt).toContain('280');
    expect(prompt).toContain('3000');
    expect(prompt).toContain('casual');
    expect(prompt).toContain('===X===');
    expect(prompt).toContain('===LINKEDIN===');
  });
});

describe('generatePostVariants', () => {
  beforeEach(() => {
    vi.mocked(askClaude).mockReset();
  });

  it('returns an error when the response contains no delimiters', async () => {
    vi.mocked(askClaude).mockResolvedValue("Sure! I'd be happy to write those for you.");
    const result = await generatePostVariants({ idea: 'launch', platforms: ['x'] });
    expect(result).toEqual({ error: 'Generation failed. Please try again.' });
  });

  it('returns variants when the response is well-formed', async () => {
    vi.mocked(askClaude).mockResolvedValue('===X===\nHello world');
    const result = await generatePostVariants({ idea: 'launch', platforms: ['x'] });
    expect(result).toEqual({ variants: { x: 'Hello world' } });
  });
});
