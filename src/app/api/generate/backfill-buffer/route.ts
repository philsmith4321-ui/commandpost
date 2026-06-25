import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { isBufferConfigured } from '@/lib/buffer/client';
import { listUnpushedSocialGenerations, setGenerationBufferPostId } from '@/lib/queries/generation-queries';
import { draftGenerationToBuffer } from '@/lib/buffer/draft';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST() {
  if (!isBufferConfigured()) {
    return NextResponse.json({ error: 'Buffer is not configured' }, { status: 400 });
  }
  const db = getDb();
  const generations = listUnpushedSocialGenerations(db);

  let pushed = 0;
  let skipped = 0;
  let failed = 0;
  for (const g of generations) {
    const result = await draftGenerationToBuffer(g.content_type, g.result);
    if (result.pushed) {
      setGenerationBufferPostId(db, g.id, result.postId);
      pushed += 1;
    } else if (result.reason === 'no_channel' || result.reason === 'not_social') {
      skipped += 1;
    } else {
      failed += 1;
    }
  }
  return NextResponse.json({ pushed, skipped, failed });
}
