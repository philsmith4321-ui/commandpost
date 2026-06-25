import type { Platform } from '@/lib/platforms';

export type ShareMode = 'addToQueue' | 'shareNow' | 'shareNext' | 'customScheduled';
export type SchedulingType = 'automatic' | 'notification';

export interface BufferChannel {
  id: string;
  service: string;          // raw Buffer service (e.g. "twitter")
  name: string;
  platform: Platform | null; // mapped CommandPost platform, null if unsupported
}

export interface BufferPost {
  id: string;
  status: string;            // e.g. "draft" | "scheduled" | "sent" | "buffer"
  text: string;
  dueAt: string | null;      // ISO
  sentAt: string | null;     // ISO
  channelId: string;
  channelService: string;
  platform: Platform | null;
  shareMode: ShareMode | null;
  externalLink: string | null;
  allowedActions: string[];  // gates edit/delete buttons
}

export interface CreatePostArgs {
  channelIds: string[];      // fans out to one createPost per channel
  text: string;
  mode: ShareMode;
  dueAt?: string;            // required when mode === 'customScheduled'
}

export interface EditPostArgs {
  id: string;
  mode: ShareMode;
  text?: string;
  dueAt?: string;
}
