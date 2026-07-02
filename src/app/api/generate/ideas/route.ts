import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateIdeas, getCachedIdeas } from '@/lib/generation/ideas';

export const maxDuration = 60;

export async function GET() {
  const db = getDb();
  return NextResponse.json(getCachedIdeas(db) ?? { ideas: [], generatedAt: null });
}

export async function POST() {
  const db = getDb();
  const result = await generateIdeas(db);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json(result);
}
