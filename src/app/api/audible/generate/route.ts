import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { retrieveContext, type RetrievedChunk } from '@/lib/rag/retrieve';
import { generateContent } from '@/lib/generation/generate';
import { createGeneration } from '@/lib/queries/generation-queries';
import { isContentType, LENGTHS } from '@/lib/generation/content-types';
import { listAudibleKbDocuments, storyDocIdsByTheme } from '@/lib/queries/kb-queries';
import { groupAudibleDocsByLabel, isStoryTheme } from '@/lib/audible';
import type { LengthPreference, RetrievalMode } from '@/lib/types';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const contentType = body?.contentType;
  const topic = typeof body?.topic === 'string' ? body.topic.trim() : '';
  const length = (LENGTHS.includes(body?.length) ? body.length : 'medium') as LengthPreference;
  // Dedupe: a repeated label/theme would otherwise drive duplicate retrieval
  // passes and a bloated persisted source_ids.
  const categories: string[] = Array.isArray(body?.categories)
    ? [...new Set<string>(body.categories.filter((c: unknown): c is string => typeof c === 'string' && c.trim().length > 0))]
    : [];
  // Story themes are a second kind of source: each expands to every story doc
  // carrying that theme, so a draft can pull from books/themes AND stories together.
  const storyThemes: string[] = Array.isArray(body?.storyThemes)
    ? [...new Set<string>(body.storyThemes.filter((c: unknown): c is string => typeof c === 'string' && c.trim().length > 0))]
    : [];

  if (!isContentType(contentType)) return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
  if (!topic) return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
  // This page never produces ungrounded output: at least one source is required.
  if (categories.length + storyThemes.length === 0) {
    return NextResponse.json({ error: 'Select at least one theme, book, or story theme' }, { status: 400 });
  }
  const unknownThemes = storyThemes.filter((t) => !isStoryTheme(t));
  if (unknownThemes.length > 0) {
    return NextResponse.json({ error: `Unknown story themes: ${unknownThemes.join(', ')}` }, { status: 400 });
  }

  const db = getDb();

  // Resolve categories server-side by LABEL (the same label the page displays,
  // via the shared audibleDocLabel helper — themes and book deep-notes alike),
  // so re-sync id churn can't produce silently-ungrounded output from stale
  // client-supplied ids, and any doc the page lists is resolvable. The list is
  // newest-first, so keeping the FIRST doc per label means an orphaned older
  // duplicate (failed sync DELETE) never wins.
  const docs = listAudibleKbDocuments(db);
  // Story docs are selected by theme (below), never as a category label —
  // groupAudibleDocsByLabel skips them and keeps the newest doc per label.
  const byLabel = groupAudibleDocsByLabel(docs);
  const catDocIds: number[] = [];
  const unknown: string[] = [];
  for (const name of categories) {
    const entry = byLabel.get(name);
    if (entry) catDocIds.push(entry.doc.id);
    else unknown.push(name);
  }
  if (unknown.length > 0) {
    return NextResponse.json({ error: `Unknown categories: ${unknown.join(', ')}` }, { status: 400 });
  }

  // Retrieval groups: each category = one doc; each story theme = all its story
  // docs retrieved together (so the topic surfaces the most relevant stories in
  // that theme). One group per selected source keeps grounding balanced.
  const groups: number[][] = catDocIds.map((id) => [id]);
  const storyIds: number[] = [];
  for (const theme of storyThemes) {
    const ids = storyDocIdsByTheme(db, theme);
    if (ids.length) { groups.push(ids); storyIds.push(...ids); }
  }
  const sourceIds = [...catDocIds, ...storyIds];

  // Per-group retrieval guarantees every selected source contributes grounding —
  // a single shared-k call would let the fallback concentrate all chunks on one.
  const k = Math.max(3, Math.ceil(12 / Math.max(1, groups.length)));
  const perCategory: RetrievedChunk[][] = [];
  const modes: RetrievalMode[] = [];
  // Shared across iterations so the topic is embedded at most once (Voyage call).
  const queryVectorCache = {};
  for (const groupIds of groups) {
    const r = await retrieveContext(db, { topic, sourceIds: groupIds, k, queryVectorCache });
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
      { error: 'Selected sources have no indexed content — re-run the audible sync or `npm run ingest:stories`' },
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
