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
