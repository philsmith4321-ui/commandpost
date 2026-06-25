import { describe, it, expect } from 'vitest';
import { serviceToPlatform, platformToService } from '@/lib/buffer/map';
import { socialContentTypeToPlatform } from '@/lib/buffer/map';

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

describe('socialContentTypeToPlatform', () => {
  it('maps the three social content types to platforms', () => {
    expect(socialContentTypeToPlatform('social_linkedin')).toBe('linkedin');
    expect(socialContentTypeToPlatform('social_twitter')).toBe('x');
    expect(socialContentTypeToPlatform('social_facebook')).toBe('facebook');
  });

  it('returns null for non-social content types', () => {
    expect(socialContentTypeToPlatform('blog_article')).toBeNull();
    expect(socialContentTypeToPlatform('email')).toBeNull();
    expect(socialContentTypeToPlatform('email_sequence')).toBeNull();
    expect(socialContentTypeToPlatform('campaign_plan')).toBeNull();
  });
});
