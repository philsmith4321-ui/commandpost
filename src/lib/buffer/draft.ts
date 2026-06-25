import { isBufferConfigured } from './client';
import { listChannels, createPost } from './queries';
import { socialContentTypeToPlatform } from './map';
import type { GenContentType } from '@/lib/types';

export type DraftResult =
  | { pushed: true; postId: string; channel: string }
  | { pushed: false; reason: 'not_social' | 'not_configured' | 'no_channel' | 'error'; message?: string };

// Best-effort: never throws. Creates a Buffer DRAFT for a social generation.
export async function draftGenerationToBuffer(contentType: GenContentType, text: string): Promise<DraftResult> {
  const platform = socialContentTypeToPlatform(contentType);
  if (!platform) return { pushed: false, reason: 'not_social' };
  if (!isBufferConfigured()) return { pushed: false, reason: 'not_configured' };
  try {
    const channels = await listChannels();
    const channel = channels.find((c) => c.platform === platform);
    if (!channel) return { pushed: false, reason: 'no_channel' };
    const post = await createPost({ channelId: channel.id, text, mode: 'addToQueue', saveToDraft: true });
    return { pushed: true, postId: post.id, channel: channel.name };
  } catch (err) {
    return { pushed: false, reason: 'error', message: err instanceof Error ? err.message : 'Buffer error' };
  }
}
