import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getGeneration, deleteGeneration } from '@/lib/queries/generation-queries';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const gen = getGeneration(db, Number(id), 'audible');
  if (!gen) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(gen);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  // Kind-guarded delete: a generate-kind (or missing) row must 404, not vanish.
  const gen = getGeneration(db, Number(id), 'audible');
  if (!gen) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  deleteGeneration(db, gen.id);
  return NextResponse.json({ ok: true });
}
