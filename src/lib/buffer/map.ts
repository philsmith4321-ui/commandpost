import type { Platform } from '@/lib/platforms';
import { isPlatform } from '@/lib/platforms';

// Buffer calls X "twitter"; CommandPost calls it "x". Everything else is 1:1.
export function serviceToPlatform(service: string): Platform | null {
  if (service === 'twitter') return 'x';
  return isPlatform(service) ? service : null;
}

export function platformToService(platform: Platform): string {
  if (platform === 'x') return 'twitter';
  return platform;
}
