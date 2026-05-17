import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { createDocument } from '@/lib/queries/document-queries';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const entityType = formData.get('entity_type') as string;
  const entityId = Number(formData.get('entity_id'));

  if (!file || !entityType || !entityId) {
    return NextResponse.json({ error: 'Missing file, entity_type, or entity_id' }, { status: 400 });
  }

  const validTypes = ['client', 'project', 'invoice', 'proposal', 'contract'];
  if (!validTypes.includes(entityType)) {
    return NextResponse.json({ error: 'Invalid entity_type' }, { status: 400 });
  }

  // Max 10MB
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
  }

  const ext = path.extname(file.name) || '';
  const filename = `${crypto.randomUUID()}${ext}`;

  await mkdir(UPLOAD_DIR, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);

  const db = getDb();
  const id = createDocument(db, {
    filename,
    original_name: file.name,
    mime_type: file.type || 'application/octet-stream',
    size: file.size,
    entity_type: entityType,
    entity_id: entityId,
  });

  return NextResponse.json({ id, filename });
}
