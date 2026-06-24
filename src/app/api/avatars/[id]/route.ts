import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAvatar, updateAvatar, deleteAvatar } from '@/lib/queries/avatar-queries';

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

  updateAvatar(db, Number(id), {
    name,
    summary: typeof body?.summary === 'string' ? body.summary.trim() : null,
    description: typeof body?.description === 'string' ? body.description.trim() : null,
    tone: typeof body?.tone === 'string' ? body.tone.trim() : null,
    is_active: body?.is_active !== false,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  deleteAvatar(db, Number(id));
  return NextResponse.json({ ok: true });
}
