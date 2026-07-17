import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAudibleStory } from '@/lib/queries/kb-queries';
import { audibleDocLabel } from '@/lib/audible';

/** Full text of one Audible story doc, for the Stories browse view. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const doc = getAudibleStory(db, Number(id));
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { label } = audibleDocLabel(doc.title);
  return NextResponse.json({ id: doc.id, label, theme: doc.theme, content: doc.content });
}
