import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { createKbDocument } from '@/lib/queries/kb-queries';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  const title = typeof body?.title === 'string' && body.title.trim() ? body.title.trim() : 'Pasted text';
  if (!content) return NextResponse.json({ error: 'Text is empty' }, { status: 400 });

  const db = getDb();
  const id = createKbDocument(db, { title, source_type: 'text', content });
  return NextResponse.json({ id, title, char_count: content.length });
}
