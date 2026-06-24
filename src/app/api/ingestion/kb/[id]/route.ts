import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getKbDocument, deleteKbDocument } from '@/lib/queries/kb-queries';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const doc = getKbDocument(db, Number(id));
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(doc);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  deleteKbDocument(db, Number(id));
  return NextResponse.json({ ok: true });
}
