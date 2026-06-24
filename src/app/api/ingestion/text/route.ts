import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { createKbDocument } from '@/lib/queries/kb-queries';
import { indexDocument } from '@/lib/ingestion/index-document';
import type { KbSourceType } from '@/lib/types';

const PASTE_SOURCE_TYPES: KbSourceType[] = ['text', 'system'];

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  const title = typeof body?.title === 'string' && body.title.trim() ? body.title.trim() : 'Pasted text';
  const source_type: KbSourceType = PASTE_SOURCE_TYPES.includes(body?.source_type)
    ? body.source_type
    : 'text';
  if (!content) return NextResponse.json({ error: 'Text is empty' }, { status: 400 });

  const db = getDb();
  const id = createKbDocument(db, { title, source_type, content });
  indexDocument(db, id, content);
  return NextResponse.json({ id, title, source_type, char_count: content.length });
}
