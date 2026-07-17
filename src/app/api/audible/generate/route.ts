import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { retrieveContext, type RetrievedChunk } from '@/lib/rag/retrieve';
import { generateContent } from '@/lib/generation/generate';
import { createGeneration } from '@/lib/queries/generation-queries';
import { isContentType, LENGTHS } from '@/lib/generation/content-types';
import { listAudibleKbDocuments } from '@/lib/queries/kb-queries';
import { audibleDocLabel } from '@/lib/audible';
import type { LengthPreference, RetrievalMode } from '@/lib/types';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const contentType = body?.contentType;
  const topic = typeof body?.topic === 'string' ? body.topic.trim() : '';
  const length = (LENGTHS.includes(body?.length) ? body.length : 'medium') as LengthPreference;
  const categories: string[] = Array.isArray(body?.categories)
    ? body.categories.filter((c: unknown): c is string => typeof c === 'string' && c.trim().length > 0)
    : [];

  if (!isContentType(contentType)) return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
  if (!topic) return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
  // This page never produces ungrounded output: at least one category is required.
  if (categories.length === 0) return NextResponse.json({ error: 'Select at least one category' }, { status: 400 });

  const db = getDb();

  // Resolve categories server-side by LABEL (the same label the page displays,
  // via the shared audibleDocLabel helper — themes and book deep-notes alike),
  // so re-sync id churn can't produce silently-ungrounded output from stale
  // client-supplied ids, and any doc the page lists is resolvable. The list is
  // newest-first, so keeping the FIRST doc per label means an orphaned older
  // duplicate (failed sync DELETE) never wins.
  const docs = listAudibleKbDocuments(db);
  const byLabel = new Map<string, (typeof docs)[number]>();
  for (const d of docs) {
    const { label } = audibleDocLabel(d.title);
    if (!byLabel.has(label)) byLabel.set(label, d);
  }
  const sourceIds: number[] = [];
  const unknown: string[] = [];
  for (const name of categories) {
    const doc = byLabel.get(name);
    if (doc) sourceIds.push(doc.id);
    else unknown.push(name);
  }
  if (unknown.length > 0) {
    return NextResponse.json({ error: `Unknown categories: ${unknown.join(', ')}` }, { status: 400 });
  }

  // Per-category retrieval: one call per doc guarantees every selected category
  // contributes grounding — a single shared-k call would let the fallback
  // concentrate all chunks on one doc.
  const k = Math.max(3, Math.ceil(12 / sourceIds.length));
  const perCategory: RetrievedChunk[][] = [];
  const modes: RetrievalMode[] = [];
  // Shared across iterations so the topic is embedded at most once (Voyage call).
  const queryVectorCache = {};
  for (const docId of sourceIds) {
    const r = await retrieveContext(db, { topic, sourceIds: [docId], k, queryVectorCache });
    perCategory.push(r.chunks);
    modes.push(r.mode);
  }
  // Round-robin interleave so generateContent's context budget truncates
  // categories evenly instead of dropping whole trailing categories.
  const chunks: RetrievedChunk[] = [];
  for (let i = 0; perCategory.some((a) => i < a.length); i++) {
    for (const arr of perCategory) {
      if (i < arr.length) chunks.push(arr[i]);
    }
  }
  // Grounding backstop: a resolvable category whose doc lost its chunks (failed
  // indexing, mid-sync churn) must not produce ungrounded output on this page.
  if (chunks.length === 0) {
    return NextResponse.json(
      { error: 'Selected categories have no indexed content — re-run the audible sync' },
      { status: 400 }
    );
  }
  // Honest overall mode ranking: all-vector is 'vector'; any keyword grounding
  // shows as 'keyword'; a vector/none mix still grounded via vector.
  const mode: RetrievalMode = modes.every((m) => m === 'vector')
    ? 'vector'
    : modes.includes('keyword')
      ? 'keyword'
      : modes.includes('vector')
        ? 'vector'
        : 'none';

  const gen = await generateContent({ contentType, topic, length, chunks, audience: undefined });
  if (!gen.ok) return NextResponse.json({ error: gen.error }, { status: 502 });

  const id = createGeneration(db, {
    content_type: contentType,
    topic,
    length,
    source_ids: sourceIds,
    retrieval_mode: mode,
    result: gen.text,
    kind: 'audible',
  });

  return NextResponse.json({
    id,
    result: gen.text,
    retrieval_mode: mode,
    sources_used: chunks.length,
  });
}
