import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({ getDb: () => ({}) }));
vi.mock('@/lib/queries/generation-queries', () => ({
  listGenerations: vi.fn(),
  getGeneration: vi.fn(),
  deleteGeneration: vi.fn(),
}));

import { listGenerations, getGeneration, deleteGeneration } from '@/lib/queries/generation-queries';
import { GET as historyGET } from '@/app/api/audible/history/route';
import { GET as idGET, DELETE as idDELETE } from '@/app/api/audible/[id]/route';

// Fixture rows: one audible, one generate-kind. The mocked getGeneration honors
// the kind argument the same way the real kind-fenced query does.
const ROWS = [
  { id: 7, kind: 'audible', topic: 'reciprocity', result: 'A' },
  { id: 8, kind: 'generate', topic: 'rekindle', result: 'B' },
];

function idReq(id: number, method: string) {
  return new NextRequest(new Request(`http://localhost/api/audible/${id}`, { method }));
}
const params = (id: number) => ({ params: Promise.resolve({ id: String(id) }) });

describe('audible history + [id] routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getGeneration).mockImplementation(
      (_db, id, kind) => ROWS.find((r) => r.id === id && r.kind === kind) as never
    );
  });

  it('GET /api/audible/history lists only audible-kind generations', async () => {
    vi.mocked(listGenerations).mockReturnValue([ROWS[0]] as never);
    const res = await historyGET();
    const body = await res.json();
    expect(listGenerations).toHaveBeenCalledWith(expect.anything(), 'audible');
    expect(body.generations).toEqual([ROWS[0]]);
  });

  it('GET /api/audible/[id] returns an audible row', async () => {
    const res = await idGET(idReq(7, 'GET'), params(7));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(ROWS[0]);
    expect(getGeneration).toHaveBeenCalledWith(expect.anything(), 7, 'audible');
  });

  it('GET /api/audible/[id] on a generate-kind row → 404', async () => {
    const res = await idGET(idReq(8, 'GET'), params(8));
    expect(res.status).toBe(404);
  });

  it('GET /api/audible/[id] on a missing row → 404', async () => {
    const res = await idGET(idReq(999, 'GET'), params(999));
    expect(res.status).toBe(404);
  });

  it('DELETE /api/audible/[id] deletes an audible row after a kind-guarded get', async () => {
    const res = await idDELETE(idReq(7, 'DELETE'), params(7));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(getGeneration).toHaveBeenCalledWith(expect.anything(), 7, 'audible');
    expect(deleteGeneration).toHaveBeenCalledWith(expect.anything(), 7);
  });

  it('DELETE /api/audible/[id] on a generate-kind row → 404, nothing deleted', async () => {
    const res = await idDELETE(idReq(8, 'DELETE'), params(8));
    expect(res.status).toBe(404);
    expect(deleteGeneration).not.toHaveBeenCalled();
  });
});
