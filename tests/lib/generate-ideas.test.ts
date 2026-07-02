import { describe, it, expect } from 'vitest';
import { parseIdeas } from '@/lib/generation/ideas';

describe('parseIdeas', () => {
  it('parses a clean JSON array and fills defaults', () => {
    const out = parseIdeas(JSON.stringify([
      { title: 'Missed calls cost jobs', hook: 'speed-to-lead', contentType: 'social_linkedin' },
      { title: 'Dead leads are money', contentType: 'nonsense-type' },
    ]));
    expect(out).toHaveLength(2);
    expect(out[0].contentType).toBe('social_linkedin');
    expect(out[1].contentType).toBe('blog_article'); // invalid type falls back
    expect(out[1].hook).toBe('');
  });

  it('extracts the array from prose and code fences', () => {
    const wrapped = 'Here are your ideas:\n```json\n[{"title":"T","hook":"h","contentType":"email"}]\n```\nEnjoy!';
    expect(parseIdeas(wrapped)).toHaveLength(1);
  });

  it('caps at 15, skips junk entries, and survives garbage input', () => {
    const many = JSON.stringify(Array.from({ length: 20 }, (_, i) => ({ title: `Idea ${i}`, contentType: 'email' })));
    expect(parseIdeas(many)).toHaveLength(15);
    expect(parseIdeas(JSON.stringify([{ hook: 'no title' }, 42, null]))).toHaveLength(0);
    expect(parseIdeas('no json here')).toHaveLength(0);
    expect(parseIdeas('[{"broken": ')).toHaveLength(0);
  });
});
