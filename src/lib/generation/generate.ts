import { askClaude, isClaudeConfigured } from '@/lib/claude';
import { stripLongDashes } from '@/lib/outreach/draft';
import { CONTENT_TYPE_MAP, LENGTH_HINT } from '@/lib/generation/content-types';
import type { GenContentType, LengthPreference } from '@/lib/types';
import type { RetrievedChunk } from '@/lib/rag/retrieve';

const CONTEXT_BUDGET = 14000; // chars of reference material to include

function buildReference(chunks: RetrievedChunk[]): string {
  if (!chunks.length) return '';
  let out = '';
  for (const c of chunks) {
    const block = `[Source: ${c.doc_title}]\n${c.text}\n\n`;
    if (out.length + block.length > CONTEXT_BUDGET) break;
    out += block;
  }
  return out.trim();
}

export async function generateContent(opts: {
  contentType: GenContentType;
  topic: string;
  length: LengthPreference;
  chunks: RetrievedChunk[];
  audience?: string;
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  if (!isClaudeConfigured()) return { ok: false, error: 'AI generation is not configured (no ANTHROPIC_API_KEY).' };

  const def = CONTENT_TYPE_MAP[opts.contentType];
  if (!def) return { ok: false, error: 'Unknown content type.' };
  if (!opts.topic.trim()) return { ok: false, error: 'Enter a topic to generate from.' };

  const reference = buildReference(opts.chunks);
  const audience = opts.audience?.trim();

  // Prompt mode is a grounded assistant, not a marketing writer with a fixed
  // output format — the user's prompt decides what comes back.
  const isPrompt = opts.contentType === 'prompt';
  const role = isPrompt
    ? 'You are a knowledgeable assistant working from a curated reference library.'
    : 'You are a skilled marketing content writer.';

  const system = `${role}
${def.instruction}
${LENGTH_HINT[opts.length] ?? ''}

${audience ? `${audience}\n` : ''}
${reference
  ? 'Use the REFERENCE MATERIAL provided by the user as your factual grounding and as a guide to voice, tone, and terminology. Prefer facts and phrasing consistent with it. Do not invent specifics that contradict it.'
  : 'No reference material was provided — write from general best practices for this format.'}

CRITICAL punctuation rule: never use a long dash. No em dash (—), no en dash (–), and no "--" or "---". They make writing look AI-generated. Use commas, periods, or parentheses instead. Number ranges use a plain hyphen, e.g. "30-60 minutes". This rule is absolute.

${isPrompt
  ? 'Output only the response to the prompt — no preamble and no meta commentary.'
  : 'Output only the finished content — no preamble, no explanation, no meta commentary.'}`;

  const inputLabel = isPrompt ? 'Prompt' : 'Topic / brief';
  const userMessage = reference
    ? `${inputLabel}:\n${opts.topic}\n\n----- REFERENCE MATERIAL -----\n${reference}`
    : `${inputLabel}:\n${opts.topic}`;

  const text = await askClaude(system, userMessage, def.maxTokens, 'claude-sonnet-4-6');
  if (!text) return { ok: false, error: 'Generation failed. Please try again.' };
  return { ok: true, text: stripLongDashes(text) };
}
