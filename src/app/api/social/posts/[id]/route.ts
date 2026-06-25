import { NextRequest, NextResponse } from 'next/server';
import { editPost, deletePost } from '@/lib/buffer/queries';
import { BufferError } from '@/lib/buffer/client';
import type { ShareMode } from '@/lib/buffer/types';

export const dynamic = 'force-dynamic';

const SHARE_MODES: ShareMode[] = ['addToQueue', 'shareNow', 'shareNext', 'customScheduled'];

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const mode = body?.mode as ShareMode;
  const text = typeof body?.text === 'string' ? body.text : undefined;
  const dueAt = typeof body?.dueAt === 'string' ? body.dueAt : undefined;

  if (!SHARE_MODES.includes(mode)) return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  if (mode === 'customScheduled' && !dueAt) return NextResponse.json({ error: 'A scheduled time is required' }, { status: 400 });

  try {
    const post = await editPost({ id, mode, text, dueAt });
    return NextResponse.json({ post });
  } catch (err) {
    const message = err instanceof BufferError ? err.message : 'Failed to reach Buffer';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  try {
    const deletedId = await deletePost(id);
    return NextResponse.json({ id: deletedId });
  } catch (err) {
    const message = err instanceof BufferError ? err.message : 'Failed to reach Buffer';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
