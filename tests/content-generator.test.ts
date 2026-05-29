import { describe, it, expect } from 'vitest';
import { parsePostVariants, buildSystemPrompt } from '@/lib/content-generator';

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
