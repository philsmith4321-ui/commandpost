import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { globalSearch } from '@/lib/queries/search-queries';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') || '';
  const db = getDb();
  const results = globalSearch(db, q);
  return NextResponse.json(results);
}
