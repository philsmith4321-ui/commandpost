import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { retrieveContext, type RetrievedChunk } from '@/lib/rag/retrieve';
import { generateContent } from '@/lib/generation/generate';
import { createGeneration } from '@/lib/queries/generation-queries';
import { isContentType } from '@/lib/generation/content-types';
import { listAudibleKbDocuments } from '@/lib/queries/kb-queries';
import { AUDIBLE_TITLE_PREFIX } from '@/lib/audible';
import type { LengthPreference, RetrievalMode } from '@/lib/types';

export const maxDuration = 120;

const LENGTHS: LengthPreference[] = ['short', 'medium', 'long'];

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

  // Resolve categories server-side by NAME against the current audible doc list
  // (title === AUDIBLE_TITLE_PREFIX + name), so re-sync id churn can't produce
  // silently-ungrounded output from stale client-supplied ids.
  const docs = listAudibleKbDocuments(db);
  const byTitle = new Map(docs.map((d) => [d.title, d]));
  const sourceIds: number[] = [];
  const unknown: string[] = [];
  for (const name of categories) {
    const doc = byTitle.get(AUDIBLE_TITLE_PREFIX + name);
    if (doc) sourceIds.push(doc.id);
    else unknown.push(name);
  }
  if (unknown.length > 0) {
    return NextResponse.json({ error: `Unknown categories: ${unknown.join(', ')}` }, { status: 400 });
  }

  // Per-category retrieval, merged (KTD9): one call per doc guarantees every
  // selected category contributes grounding — a single shared-k call would let
  // the fallback concentrate all chunks on one doc.
  const k = Math.max(3, Math.ceil(12 / sourceIds.length));
  const chunks: RetrievedChunk[] = [];
  const modes: RetrievalMode[] = [];
  for (const docId of sourceIds) {
    const r = await retrieveContext(db, { topic, sourceIds: [docId], k });
    chunks.push(...r.chunks);
    modes.push(r.mode);
  }
  // Honest overall mode: 'vector' only if every call used vector; otherwise the
  // first non-vector mode.
  const mode: RetrievalMode = modes.every((m) => m === 'vector')
    ? 'vector'
    : (modes.find((m) => m !== 'vector') ?? 'none');

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
