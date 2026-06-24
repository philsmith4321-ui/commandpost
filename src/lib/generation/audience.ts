import type { Avatar } from '@/lib/types';

/** Build a persona instruction block for a single avatar. */
export function avatarToAudience(a: Avatar): string {
  const lines = [`Target audience persona — "${a.name}":`];
  if (a.summary) lines.push(a.summary);
  if (a.description) lines.push(a.description);
  lines.push('Write specifically for this person — speak to their goals, concerns, and language.');
  if (a.tone) lines.push(`Tone for this audience: ${a.tone}`);
  return lines.join('\n');
}

/** Build a blended instruction addressing all provided avatars. */
export function blendedAudience(avatars: Avatar[]): string {
  if (avatars.length === 0) return '';
  const list = avatars
    .map((a) => `- ${a.name}${a.summary ? `: ${a.summary}` : ''}`)
    .join('\n');
  return `Target audiences (write so the piece resonates with ALL of these personas):\n${list}`;
}
