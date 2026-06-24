import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { createKbDocument } from '@/lib/queries/kb-queries';
import { fetchWebsite } from '@/lib/ingestion/extract';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const url = typeof body?.url === 'string' ? body.url.trim() : '';
  if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 });

  try {
    const { title, content } = await fetchWebsite(url);
    const db = getDb();
    const id = createKbDocument(db, { title, source_type: 'website', source_url: url, content });
    return NextResponse.json({ id, title, char_count: content.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to ingest website' },
      { status: 400 }
    );
  }
}
