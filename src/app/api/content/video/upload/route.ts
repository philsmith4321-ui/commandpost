import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getDb } from '@/lib/db';
import { createMediaItem } from '@/lib/queries/media-queries';
import { UPLOAD_DIR, MEDIA_EXTENSIONS, mimeForFile } from '@/lib/media/paths';
import type { MediaType } from '@/lib/types';

const MAX_BYTES = 1.2 * 1024 * 1024 * 1024; // 1.2 GB (matches UI copy)
const VALID_TYPES: MediaType[] = ['podcast', 'radio', 'video', 'interview', 'other'];

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get('file') as File | null;
  const title = (form.get('title') as string | null)?.trim();
  const typeRaw = (form.get('type') as string | null) || 'podcast';
  const media_type = (VALID_TYPES.includes(typeRaw as MediaType) ? typeRaw : 'podcast') as MediaType;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large (max 1.2 GB)' }, { status: 400 });
  }

  const ext = path.extname(file.name).toLowerCase();
  if (!MEDIA_EXTENSIONS.includes(ext)) {
    return NextResponse.json({ error: `Unsupported file type: ${ext || 'unknown'}` }, { status: 400 });
  }

  const filename = `media-${crypto.randomUUID()}${ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);

  const db = getDb();
  const id = createMediaItem(db, {
    title: title || file.name.replace(/\.[^.]+$/, ''),
    media_type,
    source: 'upload',
    filename,
    original_name: file.name,
    mime_type: file.type || mimeForFile(filename),
    size: file.size,
    status: 'queued',
  });

  // Fire-and-forget transcription worker. It transcribes with Whisper, writes the
  // transcript/segments back to the DB, then triggers shorts extraction.
  try {
    const python =
      process.env.WHISPER_PYTHON || path.join(process.cwd(), '.venv', 'bin', 'python3');
    const script = path.join(process.cwd(), 'scripts', 'transcribe_worker.py');
    const child = spawn(python, [script, String(id)], {
      detached: true,
      stdio: 'ignore',
      cwd: process.cwd(),
      env: process.env,
    });
    child.unref();
  } catch (err) {
    console.error('Failed to spawn transcription worker:', err);
  }

  return NextResponse.json({ id });
}
