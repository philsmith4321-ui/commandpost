import type { Platform } from '@/lib/platforms';
import type { Publisher } from './types';

// Phase 1: empty. Each Phase-2 platform integration registers its Publisher here.
const registry: Partial<Record<Platform, Publisher>> = {};

export function getPublisher(platform: Platform): Publisher | undefined {
  return registry[platform];
}

export function isPlatformConfigured(platform: Platform): boolean {
  const publisher = registry[platform];
  return !!publisher && publisher.isConfigured();
}
