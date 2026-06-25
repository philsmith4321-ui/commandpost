import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAvatar, updateAvatar, deleteAvatar } from '@/lib/queries/avatar-queries';

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

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const avatar = getAvatar(db, Number(id));
  if (!avatar) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(avatar);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  if (!getAvatar(db, Number(id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  updateAvatar(db, Number(id), { name, ...parseAvatarBody(body) });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  deleteAvatar(db, Number(id));
  return NextResponse.json({ ok: true });
}
