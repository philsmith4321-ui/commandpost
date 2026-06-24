import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { access } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getDb } from '@/lib/db';
import { getClip, getMediaItem, setClipCut } from '@/lib/queries/media-queries';
import { UPLOAD_DIR } from '@/lib/media/paths';

export const maxDuration = 300;

const VIDEO_EXT = ['.mp4', '.mov', '.webm'];

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
    const child = spawn(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

/** Cut a clip from the source media file using ffmpeg. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ clipId: string }> }) {
  const { clipId } = await params;
  const db = getDb();
  const clip = getClip(db, Number(clipId));
  if (!clip) return NextResponse.json({ error: 'Clip not found' }, { status: 404 });

  const item = getMediaItem(db, clip.media_item_id);
  if (!item || !item.filename) {
    return NextResponse.json(
      { error: 'No source media file to cut from (this item came from a transcript only).' },
      { status: 400 }
    );
  }

  const start = Math.max(0, clip.start_seconds);
  const duration = Math.max(1, clip.end_seconds - clip.start_seconds);
  if (clip.end_seconds <= clip.start_seconds) {
    return NextResponse.json({ error: 'Clip has no valid time range to cut.' }, { status: 400 });
  }

  const inputPath = path.join(UPLOAD_DIR, path.basename(item.filename));
  try {
    await access(inputPath);
  } catch {
    return NextResponse.json({ error: 'Source media file is missing.' }, { status: 404 });
  }

  const srcExt = path.extname(item.filename).toLowerCase();
  const isVideo = VIDEO_EXT.includes(srcExt);
  const outExt = isVideo ? '.mp4' : '.mp3';
  const outName = `clip-${crypto.randomUUID()}${outExt}`;
  const outPath = path.join(UPLOAD_DIR, outName);

  const args = isVideo
    ? ['-y', '-ss', String(start), '-i', inputPath, '-t', String(duration),
       '-c:v', 'libx264', '-preset', 'veryfast', '-c:a', 'aac', '-movflags', '+faststart', outPath]
    : ['-y', '-ss', String(start), '-i', inputPath, '-t', String(duration),
       '-c:a', 'libmp3lame', '-q:a', '2', outPath];

  try {
    await runFfmpeg(args);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'ffmpeg failed' },
      { status: 500 }
    );
  }

  setClipCut(db, Number(clipId), outName);
  return NextResponse.json({ filename: outName });
}
