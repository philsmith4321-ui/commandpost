import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { listAvatars, createAvatar } from '@/lib/queries/avatar-queries';

function parseAvatarBody(body: Record<string, unknown> | null) {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
  return {
    summary: str(body?.summary),
    description: str(body?.description),
    tone: str(body?.tone),
    is_active: body?.is_active !== false,
    persona: str(body?.persona),
    buying_trigger: str(body?.buying_trigger),
    proof_point: str(body?.proof_point),
    writing_target: str(body?.writing_target),
    what_tried: str(body?.what_tried),
    pains: arr(body?.pains),
    desires: arr(body?.desires),
    objections: arr(body?.objections),
    vocabulary: arr(body?.vocabulary),
    trust_triggers: arr(body?.trust_triggers),
    channels: arr(body?.channels),
  };
}

export async function GET() {
  const db = getDb();
  return NextResponse.json({ avatars: listAvatars(db) });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const db = getDb();
  const id = createAvatar(db, { name, ...parseAvatarBody(body) });
  return NextResponse.json({ id });
}
