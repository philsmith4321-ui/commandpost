import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { createMediaItem } from '@/lib/queries/media-queries';
import { runExtraction } from '@/lib/media/extract-runner';
import type { MediaType } from '@/lib/types';

const VALID_TYPES: MediaType[] = ['podcast', 'radio', 'video', 'interview', 'other'];

export const maxDuration = 120;

/** Extract shorts directly from a pasted transcript (no media file). */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const transcript = typeof body?.transcript === 'string' ? body.transcript.trim() : '';
  const title = typeof body?.title === 'string' && body.title.trim() ? body.title.trim() : 'Pasted transcript';
  const typeRaw = typeof body?.type === 'string' ? body.type : 'podcast';
  const media_type = (VALID_TYPES.includes(typeRaw as MediaType) ? typeRaw : 'podcast') as MediaType;

  if (!transcript) {
    return NextResponse.json({ error: 'Transcript is empty' }, { status: 400 });
  }

  const db = getDb();
  const id = createMediaItem(db, {
    title,
    media_type,
    source: 'transcript',
    transcript,
    status: 'extracting',
  });

  await runExtraction(db, id);

  return NextResponse.json({ id });
}
