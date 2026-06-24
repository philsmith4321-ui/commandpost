import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { chunksNeedingEmbedding, setChunkEmbedding, embeddingCounts } from '@/lib/queries/kb-queries';
import { isVoyageConfigured, embedDocuments } from '@/lib/rag/embed';

export const maxDuration = 300;

/**
 * Embed any chunks that don't yet have a vector (used to backfill the KB once a
 * VOYAGE_API_KEY is configured). Processes up to `limit` chunks per call.
 */
export async function POST() {
  if (!isVoyageConfigured()) {
    return NextResponse.json({ error: 'VOYAGE_API_KEY is not configured' }, { status: 400 });
  }

  const db = getDb();
  const pending = chunksNeedingEmbedding(db, 256);
  if (pending.length === 0) {
    return NextResponse.json({ embedded_now: 0, ...embeddingCounts(db), done: true });
  }

  const vectors = await embedDocuments(pending.map((c) => c.text));
  if (!vectors) return NextResponse.json({ error: 'Embedding request failed' }, { status: 502 });

  const tx = db.transaction(() => {
    pending.forEach((c, i) => setChunkEmbedding(db, c.id, vectors[i]));
  });
  tx();

  const counts = embeddingCounts(db);
  return NextResponse.json({ embedded_now: pending.length, ...counts, done: counts.embedded >= counts.total });
}
