import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getGeneration, deleteGeneration } from '@/lib/queries/generation-queries';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const gen = getGeneration(db, Number(id));
  if (!gen) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(gen);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  // Kind fence: getGeneration defaults to kind='generate', so Audible rows
  // 404 here instead of being deletable through the Generate surface.
  const gen = getGeneration(db, Number(id));
  if (!gen) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  deleteGeneration(db, gen.id);
  return NextResponse.json({ ok: true });
}
