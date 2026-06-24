import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { listKbDocuments, kbStats } from '@/lib/queries/kb-queries';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') || undefined;
  const db = getDb();
  return NextResponse.json({ documents: listKbDocuments(db, q), stats: kbStats(db) });
}
