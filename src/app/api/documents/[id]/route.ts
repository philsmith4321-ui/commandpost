import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getDocument, deleteDocument } from '@/lib/queries/document-queries';
import { readFile, unlink } from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const doc = getDocument(db, Number(id));
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const buffer = await readFile(path.join(UPLOAD_DIR, doc.filename));
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': doc.mime_type,
        'Content-Disposition': `inline; filename="${doc.original_name}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const doc = getDocument(db, Number(id));
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    await unlink(path.join(UPLOAD_DIR, doc.filename));
  } catch { /* file may already be gone */ }

  deleteDocument(db, Number(id));
  return NextResponse.json({ ok: true });
}
