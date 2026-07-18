import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { initDb } from '@/lib/db';
import type Database from 'better-sqlite3';

let testDb: Database.Database;

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getDb: () => testDb };
});
vi.mock('@/lib/ingestion/index-document', () => ({ indexDocument: vi.fn() }));

import { POST } from '@/app/api/ingestion/text/route';

function req(body: unknown) {
  return new NextRequest(
    new Request('http://localhost/api/ingestion/text', { method: 'POST', body: JSON.stringify(body) })
  );
}

function docSetOf(id: number): string | null {
  return (db().prepare('SELECT doc_set FROM kb_documents WHERE id = ?').get(id) as { doc_set: string | null }).doc_set;
}
function docCount(): number {
  return (db().prepare('SELECT COUNT(*) as n FROM kb_documents').get() as { n: number }).n;
}
function db() { return testDb; }

describe('/api/ingestion/text doc_set', () => {
  beforeEach(() => { testDb = initDb(':memory:'); });

  it("persists doc_set 'audible'", async () => {
    const res = await POST(req({ content: 'hello world', title: 'Audible — Influence', doc_set: 'audible' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(docSetOf(body.id)).toBe('audible');
  });

  it('rejects any other non-null doc_set with 400 and persists nothing', async () => {
    const res = await POST(req({ content: 'hello world', doc_set: 'other' }));
    expect(res.status).toBe(400);
    expect(docCount()).toBe(0);
  });

  it('defaults doc_set to NULL when omitted', async () => {
    const res = await POST(req({ content: 'hello world', title: 'plain' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(docSetOf(body.id)).toBeNull();
  });
});

describe('/api/ingestion/text author', () => {
  beforeEach(() => { testDb = initDb(':memory:'); });

  function authorOf(id: number): string | null {
    return (db().prepare('SELECT author FROM kb_documents WHERE id = ?').get(id) as { author: string | null }).author;
  }

  it('persists a trimmed author and echoes it', async () => {
    const res = await POST(req({
      content: 'note body', title: 'Audible Book — Deep Work', doc_set: 'audible', author: '  Cal Newport  ',
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.author).toBe('Cal Newport');
    expect(authorOf(body.id)).toBe('Cal Newport');
  });

  it('stores NULL when author is omitted, empty, or not a string', async () => {
    for (const author of [undefined, '', '   ', 42]) {
      const res = await POST(req({ content: 'note body', title: `t-${String(author)}`, author }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(authorOf(body.id)).toBeNull();
    }
  });
});
