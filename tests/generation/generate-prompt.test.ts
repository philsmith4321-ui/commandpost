import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/claude', () => ({
  isClaudeConfigured: () => true,
  askClaude: vi.fn().mockResolvedValue('ANSWER'),
}));
vi.mock('@/lib/outreach/draft', () => ({ stripLongDashes: (t: string) => t }));

import { askClaude } from '@/lib/claude';
import { generateContent } from '@/lib/generation/generate';
import { CONTENT_TYPES, isContentType, contentTypeLabel } from '@/lib/generation/content-types';
import type { RetrievedChunk } from '@/lib/rag/retrieve';

const CHUNKS: RetrievedChunk[] = [
  { text: 'reciprocity creates obligation', doc_title: 'Audible — Influence', source_type: 'text', score: 1 },
];

describe("free-form 'prompt' content type", () => {
  beforeEach(() => vi.clearAllMocks());

  it('is a valid content type labeled Prompt, but hidden from the shared CONTENT_TYPES list', () => {
    expect(isContentType('prompt')).toBe(true);
    expect(contentTypeLabel('prompt')).toBe('Prompt');
    // The /generate page renders CONTENT_TYPES directly — Prompt is Audible-only.
    expect(CONTENT_TYPES.some((t) => t.value === 'prompt')).toBe(false);
  });

  it('rejects Object.prototype keys as content types', () => {
    expect(isContentType('toString')).toBe(false);
    expect(isContentType('constructor')).toBe(false);
  });

  it('prompt mode drops the marketing-writer format framing and follows the prompt', async () => {
    const res = await generateContent({
      contentType: 'prompt', topic: 'What does Cialdini say about reciprocity?',
      length: 'medium', chunks: CHUNKS,
    });
    expect(res).toEqual({ ok: true, text: 'ANSWER' });
    const [system, userMessage] = vi.mocked(askClaude).mock.calls[0];
    expect(system).not.toContain('marketing content writer');
    expect(system.toLowerCase()).toContain('prompt');
    expect(userMessage).toMatch(/^Prompt:\n/);
    expect(userMessage).not.toContain('Topic / brief:');
  });

  it('prompt mode stays grounded in the reference material and honors length + dash rules', async () => {
    await generateContent({
      contentType: 'prompt', topic: 'Summarize the key ideas', length: 'short', chunks: CHUNKS,
    });
    const [system, userMessage] = vi.mocked(askClaude).mock.calls[0];
    expect(system).toContain('REFERENCE MATERIAL');
    expect(system).toContain('shorter end');
    expect(system).toContain('long dash');
    expect(userMessage).toContain('reciprocity creates obligation');
  });

  it('existing content types keep the marketing-writer prompt unchanged', async () => {
    await generateContent({
      contentType: 'blog_article', topic: 'reciprocity', length: 'medium', chunks: CHUNKS,
    });
    const [system, userMessage] = vi.mocked(askClaude).mock.calls[0];
    expect(system).toContain('marketing content writer');
    expect(userMessage).toContain('Topic / brief:');
  });
});
