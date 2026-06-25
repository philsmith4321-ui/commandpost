import type { Platform } from '@/lib/platforms';
import { isPlatform } from '@/lib/platforms';
import type { GenContentType } from '@/lib/types';

// Buffer calls X "twitter"; CommandPost calls it "x". Everything else is 1:1.
export function serviceToPlatform(service: string): Platform | null {
  if (service === 'twitter') return 'x';
  return isPlatform(service) ? service : null;
}

export function platformToService(platform: Platform): string {
  if (platform === 'x') return 'twitter';
  return platform;
}

// Generate's social content types → CommandPost Platform. Non-social → null.
export function socialContentTypeToPlatform(contentType: GenContentType): Platform | null {
  switch (contentType) {
    case 'social_linkedin': return 'linkedin';
    case 'social_twitter': return 'x';
    case 'social_facebook': return 'facebook';
    default: return null;
  }
}
