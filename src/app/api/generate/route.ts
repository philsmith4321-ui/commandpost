import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { retrieveContext } from '@/lib/rag/retrieve';
import { generateContent } from '@/lib/generation/generate';
import { createGeneration } from '@/lib/queries/generation-queries';
import { isContentType } from '@/lib/generation/content-types';
import { getAvatar, listAvatars } from '@/lib/queries/avatar-queries';
import { composeAudience } from '@/lib/generation/audience';
import { getMasterProfile } from '@/lib/queries/master-queries';
import type { LengthPreference } from '@/lib/types';

export const maxDuration = 120;

const LENGTHS: LengthPreference[] = ['short', 'medium', 'long'];

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const contentType = body?.contentType;
  const topic = typeof body?.topic === 'string' ? body.topic.trim() : '';
  const length = (LENGTHS.includes(body?.length) ? body.length : 'medium') as LengthPreference;
  const sourceIds: number[] = Array.isArray(body?.sourceIds)
    ? body.sourceIds.map((n: unknown) => Number(n)).filter((n: number) => Number.isFinite(n))
    : [];

  if (!isContentType(contentType)) return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
  if (!topic) return NextResponse.json({ error: 'Topic is required' }, { status: 400 });

  const db = getDb();

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

  return NextResponse.json({
    id,
    result: gen.text,
    retrieval_mode: mode,
    sources_used: chunks.length,
  });
}
