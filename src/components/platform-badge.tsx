import { type Platform, PLATFORMS } from '@/lib/platforms';

export function PlatformBadge({ platform }: { platform: Platform }) {
  const cfg = PLATFORMS[platform];
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-800 text-gray-300">
      <span className="font-bold">{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}
