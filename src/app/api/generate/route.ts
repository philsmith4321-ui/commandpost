import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { retrieveContext } from '@/lib/rag/retrieve';
import { generateContent } from '@/lib/generation/generate';
import { createGeneration, setGenerationBufferPostId } from '@/lib/queries/generation-queries';
import { draftGenerationToBuffer } from '@/lib/buffer/draft';
import { isContentType, LENGTHS } from '@/lib/generation/content-types';
import { listAudibleKbDocuments } from '@/lib/queries/kb-queries';
import { getAvatar, listAvatars } from '@/lib/queries/avatar-queries';
import { composeAudience } from '@/lib/generation/audience';
import { getMasterProfile } from '@/lib/queries/master-queries';
import type { LengthPreference } from '@/lib/types';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const contentType = body?.contentType;
  const topic = typeof body?.topic === 'string' ? body.topic.trim() : '';
  const length = (LENGTHS.includes(body?.length) ? body.length : 'medium') as LengthPreference;
  const sourceIds: number[] = Array.isArray(body?.sourceIds)
    ? body.sourceIds.map((n: unknown) => Number(n)).filter((n: number) => Number.isFinite(n))
    : [];

  // 'prompt' is Audible-studio-only; isContentType accepts it pipeline-wide,
  // so this route must fence it explicitly (same spirit as the Audible-doc
  // sourceIds fence below).
  if (!isContentType(contentType) || contentType === 'prompt') {
    return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
  }
  if (!topic) return NextResponse.json({ error: 'Topic is required' }, { status: 400 });

  const db = getDb();

  // Fence: this route must never ground output in Audible-set docs, even via
  // crafted sourceIds (KB ids are guessable sequential ints). Reject before
  // any retrieval, generation, persistence, or Buffer auto-draft.
  if (sourceIds.length) {
    const audibleIds = new Set(listAudibleKbDocuments(db).map((d) => d.id));
    if (sourceIds.some((id) => audibleIds.has(id))) {
      return NextResponse.json({ error: 'Invalid source ids' }, { status: 400 });
    }
  }

  // Resolve audience: master is ALWAYS applied; pick one vertical, 'all' (generic), or none (master only).
  const master = getMasterProfile(db);
  const avatarParam = body?.avatar; // number | 'all' | null
  let audience: string | undefined;
  let avatarId: number | null = null;
  if (avatarParam === 'all') {
    audience = composeAudience(master, null, { allVerticals: listAvatars(db, true) }) || undefined;
  } else if (Number.isFinite(Number(avatarParam))) {
    const avatar = getAvatar(db, Number(avatarParam));
    if (avatar) { audience = composeAudience(master, avatar) || undefined; avatarId = avatar.id; }
    else { audience = composeAudience(master, null) || undefined; }
  } else {
    audience = composeAudience(master, null) || undefined; // master only / general
  }

  const { chunks, mode } = await retrieveContext(db, { topic, sourceIds });
  const gen = await generateContent({ contentType, topic, length, chunks, audience });
  if (!gen.ok) return NextResponse.json({ error: gen.error }, { status: 502 });

  const id = createGeneration(db, {
    content_type: contentType,
    topic,
    length,
    source_ids: sourceIds,
    retrieval_mode: mode,
    avatar_id: avatarId,
    result: gen.text,
  });

  // Auto-draft social generations to Buffer (best-effort; never fails the generation).
  const draft = await draftGenerationToBuffer(contentType, gen.text);
  let buffer: { pushed: true; channel: string } | { pushed: false; reason: string };
  if (draft.pushed) {
    try { setGenerationBufferPostId(db, id, draft.postId); } catch { /* best-effort: never fail the generation */ }
    buffer = { pushed: true, channel: draft.channel };
  } else {
    buffer = { pushed: false, reason: draft.reason };
  }

  return NextResponse.json({
    id,
    result: gen.text,
    retrieval_mode: mode,
    sources_used: chunks.length,
    buffer,
  });
}
