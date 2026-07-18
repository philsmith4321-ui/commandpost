import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { createKbDocument } from '@/lib/queries/kb-queries';
import { indexDocument } from '@/lib/ingestion/index-document';
import { AUDIBLE_DOC_SET } from '@/lib/audible';
import type { KbSourceType } from '@/lib/types';

const PASTE_SOURCE_TYPES: KbSourceType[] = ['text', 'system'];

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  const title = typeof body?.title === 'string' && body.title.trim() ? body.title.trim() : 'Pasted text';
  const source_type: KbSourceType = PASTE_SOURCE_TYPES.includes(body?.source_type)
    ? body.source_type
    : 'text';
  // doc_set: only the Audible set may be targeted explicitly; anything else is general KB (NULL).
  const doc_set: string | null = body?.doc_set ?? null;
  if (doc_set !== null && doc_set !== AUDIBLE_DOC_SET) {
    return NextResponse.json({ error: `doc_set must be '${AUDIBLE_DOC_SET}' or omitted` }, { status: 400 });
  }
  if (!content) return NextResponse.json({ error: 'Text is empty' }, { status: 400 });
  // author: display/search metadata for Audible book docs (never a fence).
  const author: string | null =
    typeof body?.author === 'string' && body.author.trim() ? body.author.trim() : null;

  const db = getDb();
  const id = createKbDocument(db, { title, source_type, content, doc_set, author });
  indexDocument(db, id, content);
  return NextResponse.json({ id, title, source_type, doc_set, author, char_count: content.length });
}
