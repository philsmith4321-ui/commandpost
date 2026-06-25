import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getMasterProfile, upsertMasterProfile } from '@/lib/queries/master-queries';
import type { MasterObjection } from '@/lib/types';

export async function GET() {
  const db = getDb();
  return NextResponse.json({ master: getMasterProfile(db) });
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const strArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
  const objections: MasterObjection[] = Array.isArray(body?.objections)
    ? body.objections
        .filter((o: unknown) => o && typeof (o as { objection?: unknown }).objection === 'string')
        .map((o: { objection: string; counter?: string }) => ({
          objection: String(o.objection).trim(),
          counter: String(o.counter ?? '').trim(),
        }))
        .filter((o: MasterObjection) => o.objection)
    : [];

  const db = getDb();
  upsertMasterProfile(db, {
    identity: str(body?.identity),
    wants: str(body?.wants),
    burned_by: str(body?.burned_by),
    buying_trigger: str(body?.buying_trigger),
    tone: str(body?.tone),
    objections,
    trust_builders: strArray(body?.trust_builders),
  });
  return NextResponse.json({ ok: true });
}
