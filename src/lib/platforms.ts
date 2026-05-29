export type Platform = 'x' | 'linkedin' | 'facebook' | 'instagram';

export interface PlatformConfig {
  label: string;
  charLimit: number;
  requiresImage: boolean;
  icon: string;
}

export const PLATFORMS: Record<Platform, PlatformConfig> = {
  x: { label: 'X', charLimit: 280, requiresImage: false, icon: '𝕏' },
  linkedin: { label: 'LinkedIn', charLimit: 3000, requiresImage: false, icon: 'in' },
  facebook: { label: 'Facebook', charLimit: 63206, requiresImage: false, icon: 'f' },
  instagram: { label: 'Instagram', charLimit: 2200, requiresImage: true, icon: '◐' },
};

export const PLATFORM_ORDER: Platform[] = ['x', 'linkedin', 'facebook', 'instagram'];

export function isPlatform(value: string): value is Platform {
  return value in PLATFORMS;
}
