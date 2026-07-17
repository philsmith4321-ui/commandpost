import type { GenContentType, LengthPreference } from '@/lib/types';

export interface ContentTypeDef {
  value: GenContentType;
  group: 'Long-form' | 'Campaigns' | 'Social Media';
  label: string;
  desc: string;
  instruction: string;
  maxTokens: number;
}

export const CONTENT_TYPES: ContentTypeDef[] = [
  {
    value: 'blog_article', group: 'Long-form', label: 'Blog Article', desc: '800-1200 words',
    instruction:
      'Write a complete blog article: a compelling title, a hook intro, a well-structured body with descriptive subheadings, and a concise conclusion with a call to action.',
    maxTokens: 3500,
  },
  {
    value: 'email', group: 'Long-form', label: 'Email Newsletter', desc: '300-500 words',
    instruction:
      'Write an email newsletter: a subject line, a short greeting, a focused body, and a single clear call to action.',
    maxTokens: 1400,
  },
  {
    value: 'email_sequence', group: 'Campaigns', label: 'Email Sequence', desc: '3-5 nurture emails',
    instruction:
      'Write a 3-5 email nurture sequence. Number each email (Email 1, Email 2, …). Give each its own subject line and body, escalating toward a clear call to action by the final email.',
    maxTokens: 3500,
  },
  {
    value: 'campaign_plan', group: 'Campaigns', label: 'Campaign Plan', desc: 'Multi-channel plan',
    instruction:
      'Write a multi-channel marketing campaign plan: objective, target audience, core messages, channel-by-channel tactics (email, social, blog), a simple timeline, and success metrics.',
    maxTokens: 3000,
  },
  {
    value: 'social_linkedin', group: 'Social Media', label: 'LinkedIn Post', desc: '3-5 sentences',
    instruction: 'Write a LinkedIn post: 3-5 sentences, professional and value-driven, with up to 3 relevant hashtags.',
    maxTokens: 700,
  },
  {
    value: 'social_twitter', group: 'Social Media', label: 'Twitter / X Post', desc: '< 280 chars',
    instruction: 'Write a single Twitter/X post under 280 characters. Punchy and self-contained. At most 2 hashtags.',
    maxTokens: 400,
  },
  {
    value: 'social_facebook', group: 'Social Media', label: 'Facebook Post', desc: '80-150 words',
    instruction: 'Write a Facebook post, 80-150 words, warm and conversational, ending with a light call to action.',
    maxTokens: 700,
  },
];

// Free-form prompt mode: valid everywhere in the pipeline (map, validation,
// history labels) but deliberately NOT in CONTENT_TYPES — only the Audible
// studio renders it, so the /generate page's type grid is unchanged.
export const PROMPT_TYPE: ContentTypeDef = {
  value: 'prompt', group: 'Long-form', label: 'Prompt', desc: 'Ask anything',
  instruction:
    "Follow the user's PROMPT exactly: answer questions, summarize, compare, extract, outline, brainstorm, or produce whatever the prompt asks for, in whatever form fits it best.",
  maxTokens: 4000,
};

export const ALL_CONTENT_TYPES: ContentTypeDef[] = [...CONTENT_TYPES, PROMPT_TYPE];

export const CONTENT_TYPE_MAP: Record<GenContentType, ContentTypeDef> = Object.fromEntries(
  ALL_CONTENT_TYPES.map((t) => [t.value, t])
) as Record<GenContentType, ContentTypeDef>;

export function isContentType(v: unknown): v is GenContentType {
  return typeof v === 'string' && v in CONTENT_TYPE_MAP;
}

export function contentTypeLabel(c: GenContentType): string {
  return CONTENT_TYPE_MAP[c]?.label ?? c;
}

export const LENGTHS: LengthPreference[] = ['short', 'medium', 'long'];

export const LENGTH_OPTIONS: { value: LengthPreference; label: string }[] = [
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'long', label: 'Long' },
];

export const MODE_BADGE: Record<string, string> = {
  vector: 'bg-green-600/20 text-green-400',
  keyword: 'bg-amber-600/20 text-amber-400',
  none: 'bg-gray-700 text-gray-300',
};

export const LENGTH_HINT: Record<string, string> = {
  short: 'Keep it on the shorter end of the range — tight and punchy.',
  medium: 'Aim for the middle of the typical length range.',
  long: 'Lean toward the longer, more thorough end of the range.',
};
