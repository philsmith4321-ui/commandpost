import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { createMediaItem } from '@/lib/queries/media-queries';
import { runExtraction } from '@/lib/media/extract-runner';
import type { MediaType, TranscriptSegment } from '@/lib/types';

const VALID_TYPES: MediaType[] = ['podcast', 'radio', 'video', 'interview', 'other'];

export const maxDuration = 120;

/**
 * Ingest endpoint for local-Mac processing: the Mac transcribes locally with
 * Whisper and POSTs the transcript (+ optional timestamped segments) here.
 * Optionally protected by INGEST_SECRET via the x-ingest-secret header.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.INGEST_SECRET;
  if (secret && request.headers.get('x-ingest-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const transcript = typeof body?.transcript === 'string' ? body.transcript.trim() : '';
  const title = typeof body?.title === 'string' && body.title.trim() ? body.title.trim() : 'Local upload';
  const typeRaw = typeof body?.type === 'string' ? body.type : 'podcast';
  const media_type = (VALID_TYPES.includes(typeRaw as MediaType) ? typeRaw : 'podcast') as MediaType;
  const duration = typeof body?.duration === 'number' ? body.duration : null;

  let segments: TranscriptSegment[] = [];
  if (Array.isArray(body?.segments)) {
    segments = body.segments
      .filter((s: unknown) => s && typeof s === 'object')
      .map((s: Record<string, unknown>) => ({
        start: Number(s.start) || 0,
        end: Number(s.end) || 0,
        text: String(s.text ?? ''),
      }));
  }

  if (!transcript) {
    return NextResponse.json({ error: 'Transcript is required' }, { status: 400 });
  }

  const db = getDb();
  const id = createMediaItem(db, {
    title,
    media_type,
    source: 'local',
    transcript,
    segments: segments.length ? JSON.stringify(segments) : null,
    duration_seconds: duration,
    status: 'extracting',
  });

  await runExtraction(db, id);

  return NextResponse.json({ id });
}
