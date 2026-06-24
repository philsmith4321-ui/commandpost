import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { runExtraction } from '@/lib/media/extract-runner';

export const maxDuration = 120;

/** (Re-)run shorts extraction for an item that already has a transcript. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mediaId = Number(id);
  if (!Number.isFinite(mediaId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const db = getDb();
  await runExtraction(db, mediaId);

  return NextResponse.json({ ok: true });
}
