import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { getDb } from '@/lib/db';
import { createKbDocument } from '@/lib/queries/kb-queries';
import { htmlToText, pdfToText } from '@/lib/ingestion/extract';
import type { KbSourceType } from '@/lib/types';

export const maxDuration = 120;

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get('file') as File | null;
  const titleField = (form.get('title') as string | null)?.trim();
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File too large (max 50 MB)' }, { status: 400 });

  const ext = path.extname(file.name).toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  let content = '';
  let source_type: KbSourceType;

  try {
    if (ext === '.pdf') {
      content = await pdfToText(buffer);
      source_type = 'pdf';
    } else if (ext === '.html' || ext === '.htm') {
      content = htmlToText(buffer.toString('utf-8'));
      source_type = 'html';
    } else if (ext === '.txt' || ext === '.md' || ext === '') {
      content = buffer.toString('utf-8').trim();
      source_type = 'text';
    } else {
      return NextResponse.json({ error: `Unsupported file type: ${ext}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? `Could not read file: ${err.message}` : 'Could not read file' },
      { status: 400 }
    );
  }

  if (!content) return NextResponse.json({ error: 'No text could be extracted from that file' }, { status: 400 });

  const title = titleField || file.name.replace(/\.[^.]+$/, '');
  const db = getDb();
  const id = createKbDocument(db, { title, source_type, content });
  return NextResponse.json({ id, title, char_count: content.length });
}
