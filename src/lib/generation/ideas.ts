import type Database from 'better-sqlite3';
import { askClaude, isClaudeConfigured } from '@/lib/claude';
import { chunksForDocuments } from '@/lib/queries/kb-queries';
import { isContentType } from '@/lib/generation/content-types';
import { getSetting, setSetting } from '@/lib/queries/settings-queries';
import type { GenContentType } from '@/lib/types';

export const GENERATE_IDEAS_KEY = 'generate_ideas';

export interface ContentIdea {
  title: string;            // goes into the Topic / brief box
  hook: string;             // one line on why this works
  contentType: GenContentType;
}

export interface IdeasBatch {
  ideas: ContentIdea[];
  generatedAt: string;
}

// Evenly sample the whole knowledge base so ideas draw on all of it, not just
// the first document, while staying inside a prompt budget.
function sampleKbContext(db: Database.Database, budget = 10000): string {
  const chunks = chunksForDocuments(db);
  if (!chunks.length) return '';
  const target = Math.max(1, Math.floor(budget / 700));
  const step = Math.max(1, Math.floor(chunks.length / target));
  let out = '';
  for (let i = 0; i < chunks.length && out.length < budget; i += step) {
    out += `[${chunks[i].doc_title}]\n${chunks[i].text.slice(0, 700)}\n\n`;
  }
  return out.trim();
}

// Pull a JSON array out of a model reply that may include prose or code fences.
export function parseIdeas(text: string): ContentIdea[] {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end <= start) return [];
  let arr: unknown;
  try { arr = JSON.parse(text.slice(start, end + 1)); } catch { return []; }
  if (!Array.isArray(arr)) return [];
  const out: ContentIdea[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    if (typeof o.title !== 'string' || !o.title.trim()) continue;
    out.push({
      title: o.title.trim(),
      hook: typeof o.hook === 'string' ? o.hook.trim() : '',
      contentType: isContentType(o.contentType) ? o.contentType : 'blog_article',
    });
    if (out.length >= 15) break;
  }
  return out;
}

export async function generateIdeas(db: Database.Database): Promise<IdeasBatch | { error: string }> {
  if (!isClaudeConfigured()) return { error: 'AI generation is not configured (no ANTHROPIC_API_KEY).' };

  const reference = sampleKbContext(db);
  const system = `You are a content strategist for RekindleLeads, Phil Smith's AI-automation consultancy for small businesses in Middle Tennessee (voice: anti-hype, operator-first, "AI that earns its keep", never use em or en dashes).

Propose 12 specific, ready-to-write content ideas grounded in the reference material. Mix formats across the batch: blog_article, email, social_linkedin, social_facebook, social_twitter, email_sequence, campaign_plan. Favor concrete pain-point angles (missed calls, dead leads, follow-up, owner time) over generic "AI is amazing" takes.

Reply with ONLY a JSON array, no prose:
[{"title": "the topic/brief, one or two sentences, specific enough to write from", "hook": "one short line on why this lands with small-business owners", "contentType": "blog_article"}]`;

  const userMessage = reference
    ? `----- REFERENCE MATERIAL -----\n${reference}`
    : 'No reference material available. Base ideas on the business description in the system prompt.';

  const text = await askClaude(system, userMessage, 3000, 'claude-sonnet-4-6');
  if (!text) return { error: 'Idea generation failed. Please try again.' };
  const ideas = parseIdeas(text);
  if (!ideas.length) return { error: 'Could not parse ideas from the AI response. Please try again.' };

  const batch: IdeasBatch = { ideas, generatedAt: new Date().toISOString() };
  setSetting(db, GENERATE_IDEAS_KEY, JSON.stringify(batch));
  return batch;
}

export function getCachedIdeas(db: Database.Database): IdeasBatch | null {
  const raw = getSetting(db, GENERATE_IDEAS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as IdeasBatch;
    if (Array.isArray(parsed.ideas) && parsed.ideas.length) return parsed;
  } catch { /* fall through */ }
  return null;
}
