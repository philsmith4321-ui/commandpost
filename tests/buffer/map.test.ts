import { describe, it, expect } from 'vitest';
import { serviceToPlatform, platformToService } from '@/lib/buffer/map';

describe('buffer service <-> platform mapping', () => {
  it('maps buffer twitter to platform x and back', () => {
    expect(serviceToPlatform('twitter')).toBe('x');
    expect(platformToService('x')).toBe('twitter');
  });

  it('passes through facebook and linkedin unchanged', () => {
    expect(serviceToPlatform('facebook')).toBe('facebook');
    expect(serviceToPlatform('linkedin')).toBe('linkedin');
    expect(platformToService('facebook')).toBe('facebook');
    expect(platformToService('linkedin')).toBe('linkedin');
  });

  it('returns null for unknown/unsupported services', () => {
    expect(serviceToPlatform('mastodon')).toBeNull();
    expect(serviceToPlatform('tiktok')).toBeNull();
  });
});
