import type { Platform } from '@/lib/platforms';

export interface PublishInput {
  content: string;
  imagePath: string | null;
}

export interface PublishResult {
  platformPostId: string;
}

export interface Publisher {
  platform: Platform;
  isConfigured(): boolean;
  publish(input: PublishInput): Promise<PublishResult>;
}
