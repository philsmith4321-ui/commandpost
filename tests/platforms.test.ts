import { describe, it, expect } from 'vitest';
import { PLATFORMS, PLATFORM_ORDER, isPlatform } from '@/lib/platforms';

describe('PLATFORMS', () => {
  it('defines all four platforms with char limits', () => {
    expect(PLATFORMS.x.charLimit).toBe(280);
    expect(PLATFORMS.linkedin.charLimit).toBe(3000);
    expect(PLATFORMS.facebook.charLimit).toBe(63206);
    expect(PLATFORMS.instagram.charLimit).toBe(2200);
  });

  it('marks instagram as requiring an image', () => {
    expect(PLATFORMS.instagram.requiresImage).toBe(true);
    expect(PLATFORMS.x.requiresImage).toBe(false);
  });

  it('orders platforms x, linkedin, facebook, instagram', () => {
    expect(PLATFORM_ORDER).toEqual(['x', 'linkedin', 'facebook', 'instagram']);
  });

  it('isPlatform validates platform strings', () => {
    expect(isPlatform('x')).toBe(true);
    expect(isPlatform('myspace')).toBe(false);
  });
});
