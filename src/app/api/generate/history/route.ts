import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { listGenerations } from '@/lib/queries/generation-queries';

export async function GET() {
  const db = getDb();
  return NextResponse.json({ generations: listGenerations(db) });
}
