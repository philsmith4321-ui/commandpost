import { askClaude, isClaudeConfigured } from '@/lib/claude';
import { type Platform, PLATFORMS, PLATFORM_ORDER } from '@/lib/platforms';

const DELIMITERS: Record<Platform, string> = {
  x: '===X===',
  linkedin: '===LINKEDIN===',
  facebook: '===FACEBOOK===',
  instagram: '===INSTAGRAM===',
};

const PLATFORM_GUIDANCE: Record<Platform, string> = {
  x: 'concise and punchy, may use 1-2 hashtags',
  linkedin: 'professional and value-driven, can be a few short paragraphs',
  facebook: 'warm and conversational',
  instagram: 'an engaging caption ending with relevant hashtags',
};

export function buildSystemPrompt(platforms: Platform[], tone: string): string {
  const ordered = PLATFORM_ORDER.filter((p) => platforms.includes(p));
  const sections = ordered
    .map(
      (p) =>
        `${DELIMITERS[p]}\n[${PLATFORMS[p].label} post — ${PLATFORM_GUIDANCE[p]}; keep under ${PLATFORMS[p].charLimit} characters]`
    )
    .join('\n');

  const toneLine = tone.trim() ? `Tone/instructions: ${tone.trim()}` : 'Tone: professional but personable.';

  return `You are a social media copywriter for a freelance web developer promoting their own business.
Write one post per requested platform based on the user's idea. Tailor each to its platform.
${toneLine}

Respond using EXACTLY this format, with nothing before the first marker and no commentary:
${sections}

Replace each bracketed instruction with the actual post text. Keep each post within its character limit.`;
}

export function parsePostVariants(text: string, platforms: Platform[]): Record<Platform, string> {
  const markers = PLATFORM_ORDER.map((p) => ({ p, idx: text.indexOf(DELIMITERS[p]) }))
    .filter((m) => m.idx >= 0)
    .sort((a, b) => a.idx - b.idx);

  const result = {} as Record<Platform, string>;
  for (const p of platforms) result[p] = '';

  for (let i = 0; i < markers.length; i++) {
    const { p, idx } = markers[i];
    const start = idx + DELIMITERS[p].length;
    const end = i + 1 < markers.length ? markers[i + 1].idx : text.length;
    if (platforms.includes(p)) {
      result[p] = text.slice(start, end).trim();
    }
  }

  return result;
}

export async function generatePostVariants(input: {
  idea: string;
  platforms: Platform[];
  tone?: string;
}): Promise<{ variants: Record<Platform, string> } | { error: string }> {
  if (!isClaudeConfigured()) return { error: 'AI features are not configured.' };
  if (!input.idea.trim()) return { error: 'Enter an idea to generate from.' };
  if (input.platforms.length === 0) return { error: 'Select at least one platform.' };

  const system = buildSystemPrompt(input.platforms, input.tone ?? '');
  const response = await askClaude(system, input.idea, 2048, 'claude-sonnet-4-6');
  if (!response) return { error: 'Generation failed. Please try again.' };

  const variants = parsePostVariants(response, input.platforms);
  if (input.platforms.every((p) => !variants[p])) {
    return { error: 'Generation failed. Please try again.' };
  }
  return { variants };
}
