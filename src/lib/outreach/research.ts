import type Database from 'better-sqlite3';
import { askClaudeWithWebSearch, isClaudeConfigured } from '@/lib/claude';

export const NOTHING_FOUND = 'NOTHING FOUND';
export const RESEARCH_FRESH_DAYS = 30;

export type ResearchLeadFields = {
  id: number;
  business_name: string | null;
  contact_person: string | null;
  city: string | null;
  state: string | null;
  website: string | null;
  category: string | null;
  research_notes?: string | null;
  researched_at?: string | null;
};

export type ResearchAskFn = (system: string, user: string, maxTokens: number) => Promise<string | null>;

// Notes usable for drafting: non-empty and not the "we looked, nothing there"
// sentinel. Returns the trimmed notes or null.
export function usableResearch(notes: string | null | undefined): string | null {
  const trimmed = (notes ?? '').trim();
  if (!trimmed || trimmed === NOTHING_FOUND) return null;
  return trimmed;
}

export function isResearchFresh(researchedAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!researchedAt) return false;
  const t = Date.parse(researchedAt.includes('T') ? researchedAt : `${researchedAt}Z`.replace(' ', 'T'));
  if (Number.isNaN(t)) return false;
  return now.getTime() - t < RESEARCH_FRESH_DAYS * 86_400_000;
}

export function buildResearchPrompt(lead: ResearchLeadFields): { system: string; user: string } {
  const system = [
    'You are a research assistant preparing personalization notes for polite, professional B2B outreach.',
    'Search the web for TRUE, verifiable, business-only facts about the specific local business described.',
    '',
    'HARD RULES:',
    '- BUSINESS-ONLY. Never include personal-life details about owners or staff (family, health, hobbies, politics, home).',
    '- IDENTITY CHECK. If you cannot confirm a fact is about THIS business in THIS city (not a same-named business elsewhere), drop the fact.',
    '- Only facts you actually found in search results. Never guess or embellish.',
    '',
    'LOOK FOR: what they specifically do or sell, recent news or milestones (new location, award, anniversary, expansion), community involvement or sponsorships, consistent themes in customer reviews, hiring/growth signals.',
    '',
    'OUTPUT FORMAT: 3 to 6 bullet lines, each starting with "- ", each ending with its source URL in parentheses. No preamble, no commentary, no markdown headers.',
    `If nothing passes the rules above, output exactly: ${NOTHING_FOUND}`,
  ].join('\n');

  const parts: string[] = [];
  if (lead.business_name) parts.push(`Business: ${lead.business_name}`);
  if (lead.category) parts.push(`Category / industry: ${lead.category}`);
  const place = [lead.city, lead.state].filter(Boolean).join(', ');
  if (place) parts.push(`Location: ${place}`);
  if (lead.website) parts.push(`Website: ${lead.website}`);
  if (lead.contact_person) parts.push(`Known contact (business role context only): ${lead.contact_person}`);

  return { system, user: ['Research this business:', ...parts].join('\n') };
}

// Run research NOW (no freshness check), persist, and return the stored notes
// (possibly the sentinel). Returns null on failure without touching the row.
export async function researchLead(
  db: Database.Database,
  lead: ResearchLeadFields,
  askFn: ResearchAskFn = askClaudeWithWebSearch
): Promise<string | null> {
  const { system, user } = buildResearchPrompt(lead);
  let raw: string | null = null;
  try {
    raw = await askFn(system, user, 1500);
  } catch (err) {
    console.error(`researchLead(${lead.id}) failed:`, err);
    return null;
  }
  const notes = (raw ?? '').trim();
  if (!notes) return null;
  const stored = /^nothing found[.!]?$/i.test(notes) ? NOTHING_FOUND : notes;
  db.prepare("UPDATE leads SET research_notes = ?, researched_at = datetime('now') WHERE id = ?")
    .run(stored, lead.id);
  return stored;
}

// Freshness-aware, fail-open entry point used by drafting flows. Returns
// USABLE notes (never the sentinel) or null. Never throws.
export async function ensureFreshResearch(
  db: Database.Database,
  lead: ResearchLeadFields,
  askFn?: ResearchAskFn
): Promise<string | null> {
  try {
    if (isResearchFresh(lead.researched_at)) return usableResearch(lead.research_notes);
    if (!askFn && !isClaudeConfigured()) return usableResearch(lead.research_notes);
    const stored = await researchLead(db, lead, askFn ?? askClaudeWithWebSearch);
    if (stored == null) return usableResearch(lead.research_notes);
    return usableResearch(stored);
  } catch (err) {
    console.error(`ensureFreshResearch(${lead.id}) failed:`, err);
    return usableResearch(lead.research_notes);
  }
}
