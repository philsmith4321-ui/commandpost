import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { listMediaItemsWithClips } from '@/lib/queries/media-queries';

/** List all media items with their clips (used by the library for live polling). */
export async function GET() {
  const db = getDb();
  const items = listMediaItemsWithClips(db);
  return NextResponse.json({ items });
}
