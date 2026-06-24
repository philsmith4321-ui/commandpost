import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { listAvatars, createAvatar } from '@/lib/queries/avatar-queries';

export async function GET() {
  const db = getDb();
  return NextResponse.json({ avatars: listAvatars(db) });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const db = getDb();
  const id = createAvatar(db, {
    name,
    summary: typeof body?.summary === 'string' ? body.summary.trim() : null,
    description: typeof body?.description === 'string' ? body.description.trim() : null,
    tone: typeof body?.tone === 'string' ? body.tone.trim() : null,
    is_active: body?.is_active !== false,
  });
  return NextResponse.json({ id });
}
