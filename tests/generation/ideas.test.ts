import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initDb } from '@/lib/db';
import { createKbDocument, replaceChunks } from '@/lib/queries/kb-queries';
import { AUDIBLE_DOC_SET } from '@/lib/audible';
import { generateIdeas, parseIdeas } from '@/lib/generation/ideas';
import { askClaude } from '@/lib/claude';
import type Database from 'better-sqlite3';

vi.mock('@/lib/claude', () => ({
  isClaudeConfigured: () => true,
  askClaude: vi.fn(),
}));

let db: Database.Database;
beforeEach(() => {
  vi.clearAllMocks();
  db = initDb(':memory:');
  vi.mocked(askClaude).mockResolvedValue(
    '[{"title": "Idea one", "hook": "why it works", "contentType": "blog_article"}]'
  );
});

function seedDoc(title: string, chunkText: string, doc_set?: string) {
  const id = createKbDocument(db, {
    title,
    source_type: 'text',
    content: chunkText,
    ...(doc_set ? { doc_set } : {}),
  });
  replaceChunks(db, id, [chunkText]);
  return id;
}

describe('generateIdeas KB sampling fence', () => {
  it('samples only non-Audible chunks when both sets exist', async () => {
    seedDoc('General playbook', 'GENERAL_MARKER small business follow-up automation');
    seedDoc('Audible — Influence', 'AUDIBLE_SECRET reciprocity principle notes', AUDIBLE_DOC_SET);

    const result = await generateIdeas(db);
    expect('error' in result).toBe(false);

    const userMessage = vi.mocked(askClaude).mock.calls[0][1];
    expect(userMessage).toContain('GENERAL_MARKER');
    expect(userMessage).not.toContain('AUDIBLE_SECRET');
    expect(userMessage).not.toContain('Audible — Influence');
  });

  it('falls back to the no-reference prompt when only Audible docs exist', async () => {
    seedDoc('Audible — Only', 'AUDIBLE_SECRET nothing else in the KB', AUDIBLE_DOC_SET);

    const result = await generateIdeas(db);
    expect('error' in result).toBe(false);

    const userMessage = vi.mocked(askClaude).mock.calls[0][1];
    expect(userMessage).toContain('No reference material available');
    expect(userMessage).not.toContain('AUDIBLE_SECRET');
  });
});

describe('parseIdeas', () => {
  it('parses a fenced JSON array and drops junk entries', () => {
    const text = 'Here you go:\n```json\n[{"title": "A", "hook": "h", "contentType": "email"}, {"nope": 1}]\n```';
    const ideas = parseIdeas(text);
    expect(ideas).toEqual([{ title: 'A', hook: 'h', contentType: 'email' }]);
  });
});
