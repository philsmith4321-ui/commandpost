import { NextRequest, NextResponse } from 'next/server';
import { unlink } from 'fs/promises';
import path from 'path';
import { getDb } from '@/lib/db';
import { getMediaItemWithClips, deleteMediaItem } from '@/lib/queries/media-queries';
import { UPLOAD_DIR } from '@/lib/media/paths';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const item = getMediaItemWithClips(db, Number(id));
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(item);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const item = getMediaItemWithClips(db, Number(id));
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Best-effort cleanup of stored files.
  const files = [item.filename, ...item.clips.map((c) => c.clip_filename)].filter(Boolean) as string[];
  for (const f of files) {
    try {
      await unlink(path.join(UPLOAD_DIR, path.basename(f)));
    } catch {
      /* ignore missing files */
    }
  }

  deleteMediaItem(db, Number(id));
  return NextResponse.json({ ok: true });
}
