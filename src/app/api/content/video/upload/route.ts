import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getDb } from '@/lib/db';
import { createMediaItem } from '@/lib/queries/media-queries';
import { runExtraction } from '@/lib/media/extract-runner';
import { UPLOAD_DIR, MEDIA_EXTENSIONS, mimeForFile } from '@/lib/media/paths';
import type { MediaType } from '@/lib/types';

const MAX_BYTES = 1.2 * 1024 * 1024 * 1024; // 1.2 GB (matches UI copy)
const VALID_TYPES: MediaType[] = ['podcast', 'radio', 'video', 'interview', 'other'];

export const maxDuration = 300;

/** A form field may arrive as a string or an uploaded File (for large values). */
async function readField(v: FormDataEntryValue | null): Promise<string> {
  if (!v) return '';
  if (typeof v === 'string') return v;
  return (await v.text()).trim();
}

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

  // Optional locally-computed transcript (the Mac "CommandPost Ingest" droplet
  // transcribes with Whisper on-device and sends it here, so the server skips
  // Whisper but still keeps the media file for clip cutting).
  const localTranscript = await readField(form.get('transcript'));
  const segmentsRaw = await readField(form.get('segments'));
  const durationRaw = form.get('duration');
  const duration = durationRaw ? Number(durationRaw) : null;

  let segments: string | null = null;
  if (segmentsRaw) {
    try {
      if (Array.isArray(JSON.parse(segmentsRaw))) segments = segmentsRaw;
    } catch {
      /* ignore malformed segments */
    }
  }

  const filename = `media-${crypto.randomUUID()}${ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);

  const db = getDb();
  const hasLocalTranscript = localTranscript.length > 0;

  const id = createMediaItem(db, {
    title: title || file.name.replace(/\.[^.]+$/, ''),
    media_type,
    source: 'upload',
    filename,
    original_name: file.name,
    mime_type: file.type || mimeForFile(filename),
    size: file.size,
    duration_seconds: Number.isFinite(duration) ? duration : null,
    transcript: hasLocalTranscript ? localTranscript : null,
    segments: hasLocalTranscript ? segments : null,
    status: hasLocalTranscript ? 'extracting' : 'queued',
  });

  if (hasLocalTranscript) {
    // Transcript came from the Mac — skip Whisper, go straight to extraction.
    await runExtraction(db, id);
  } else {
    // Fire-and-forget server-side transcription worker, which transcribes with
    // Whisper, writes transcript/segments to the DB, then triggers extraction.
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
  }

  return NextResponse.json({ id });
}
