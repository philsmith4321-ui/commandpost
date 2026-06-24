import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getGeneration } from '@/lib/queries/generation-queries';
import { createPost } from '@/lib/queries/post-queries';
import type { Platform } from '@/lib/platforms';
import type { GenContentType } from '@/lib/types';

const SOCIAL_PLATFORM: Partial<Record<GenContentType, Platform>> = {
  social_linkedin: 'linkedin',
  social_twitter: 'x',
  social_facebook: 'facebook',
};

/** Save a generation as a draft Content post. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const gen = getGeneration(db, Number(id));
  if (!gen) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const title = gen.topic.length > 80 ? gen.topic.slice(0, 77) + '…' : gen.topic;
  const platform = SOCIAL_PLATFORM[gen.content_type];

  const postId = createPost(db, {
    title: title || 'Generated content',
    idea: gen.result,
    status: 'draft',
    variants: platform
      ? [{ platform, content: gen.result, enabled: true }]
      : [],
  });

  return NextResponse.json({ post_id: postId });
}
