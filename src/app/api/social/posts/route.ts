import { NextRequest, NextResponse } from 'next/server';
import { listPosts, createPost } from '@/lib/buffer/queries';
import { BufferError } from '@/lib/buffer/client';
import type { ShareMode } from '@/lib/buffer/types';

export const dynamic = 'force-dynamic';

const SHARE_MODES: ShareMode[] = ['addToQueue', 'shareNow', 'shareNext', 'customScheduled'];

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const status = params.get('status');
  const channelId = params.get('channelId');
  try {
    const posts = await listPosts({
      ...(status ? { status: [status] } : {}),
      ...(channelId ? { channelIds: [channelId] } : {}),
    });
    return NextResponse.json({ posts });
  } catch (err) {
    const message = err instanceof BufferError ? err.message : 'Failed to reach Buffer';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const channelIds: string[] = Array.isArray(body?.channelIds) ? body.channelIds.filter((c: unknown) => typeof c === 'string') : [];
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  const mode = body?.mode as ShareMode;
  const dueAt = typeof body?.dueAt === 'string' ? body.dueAt : undefined;

  if (!channelIds.length) return NextResponse.json({ error: 'Pick at least one channel' }, { status: 400 });
  if (!text) return NextResponse.json({ error: 'Text is empty' }, { status: 400 });
  if (!SHARE_MODES.includes(mode)) return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  if (mode === 'customScheduled' && !dueAt) return NextResponse.json({ error: 'A scheduled time is required' }, { status: 400 });

  try {
    const created = await Promise.all(
      channelIds.map((channelId) => createPost({ channelId, text, mode, dueAt })),
    );
    return NextResponse.json({ created });
  } catch (err) {
    const message = err instanceof BufferError ? err.message : 'Failed to reach Buffer';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
