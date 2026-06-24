import { askClaude, isClaudeConfigured } from '@/lib/claude';
import type { TranscriptSegment } from '@/lib/types';

export interface ShortSuggestion {
  title: string;
  start: number;
  end: number;
  excerpt: string;
  reason: string;
}

const DEFAULT_MAX = 6;
const MIN_CLIP = 12; // seconds
const MAX_CLIP = 75; // seconds

// Words that tend to mark a quotable / hooky moment.
const HOOK_WORDS = [
  'never', 'always', 'biggest', 'secret', 'mistake', 'truth', 'honestly', 'realize',
  'realized', 'important', 'key', 'remember', 'imagine', 'story', 'because', 'why',
  'how', 'first', 'most', 'best', 'worst', 'nobody', 'everyone', 'wrong', 'love', 'hate',
  'free', 'money', 'change', 'changed', 'powerful', 'simple', 'proven', 'mind', 'crazy',
];

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function scoreText(text: string): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const w of HOOK_WORDS) if (lower.includes(w)) score += 1;
  if (/[?!]/.test(text)) score += 1;
  // prefer a healthy amount of words, not too short
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words >= 25 && words <= 160) score += 2;
  return score;
}

function titleFromText(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const firstSentence = clean.split(/(?<=[.!?])\s/)[0] || clean;
  const t = firstSentence.length > 70 ? firstSentence.slice(0, 67).trim() + '…' : firstSentence;
  return t || 'Untitled clip';
}

/** Group whisper segments into candidate windows of ~MIN..MAX seconds. */
function windowsFromSegments(segments: TranscriptSegment[]): ShortSuggestion[] {
  const windows: ShortSuggestion[] = [];
  let i = 0;
  while (i < segments.length) {
    const start = segments[i].start;
    let end = segments[i].end;
    let text = segments[i].text;
    let j = i + 1;
    while (j < segments.length && segments[j].end - start < MAX_CLIP) {
      end = segments[j].end;
      text += ' ' + segments[j].text;
      j++;
      if (end - start >= 40) break; // aim for ~40s windows
    }
    if (end - start >= MIN_CLIP) {
      windows.push({
        title: titleFromText(text),
        start: Math.round(start * 100) / 100,
        end: Math.round(end * 100) / 100,
        excerpt: text.trim(),
        reason: 'High-signal segment',
      });
    }
    i = j > i ? j : i + 1;
  }
  return windows;
}

function heuristicFromSegments(segments: TranscriptSegment[], max: number): ShortSuggestion[] {
  const windows = windowsFromSegments(segments);
  return windows
    .map((w) => ({ w, s: scoreText(w.excerpt) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, max)
    .map(({ w, s }) => ({ ...w, reason: s > 3 ? 'Strong hook & quotable language' : 'Self-contained moment' }))
    .sort((a, b) => a.start - b.start);
}

function heuristicFromText(transcript: string, max: number): ShortSuggestion[] {
  const words = transcript.split(/\s+/).filter(Boolean);
  const chunkSize = 90;
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
  }
  return chunks
    .map((text) => ({ text, s: scoreText(text) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, max)
    .map(({ text, s }) => ({
      title: titleFromText(text),
      start: 0,
      end: 0,
      excerpt: text.trim(),
      reason: s > 3 ? 'Strong hook & quotable language' : 'Self-contained moment',
    }));
}

function parseClaudeJson(raw: string): ShortSuggestion[] | null {
  // Pull the first JSON array out of the response, tolerating code fences / prose.
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const arr = JSON.parse(match[0]) as unknown[];
    const out: ShortSuggestion[] = [];
    for (const el of arr) {
      if (!el || typeof el !== 'object') continue;
      const o = el as Record<string, unknown>;
      const start = Number(o.start ?? 0);
      const end = Number(o.end ?? 0);
      out.push({
        title: String(o.title ?? '').trim() || titleFromText(String(o.excerpt ?? 'Clip')),
        start: Number.isFinite(start) ? start : 0,
        end: Number.isFinite(end) ? end : 0,
        excerpt: String(o.excerpt ?? '').trim(),
        reason: String(o.reason ?? '').trim() || 'Suggested by AI',
      });
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}

async function claudeFromSegments(
  segments: TranscriptSegment[],
  transcript: string,
  max: number
): Promise<ShortSuggestion[] | null> {
  // Build a compact, timestamped view. Cap to keep the request bounded.
  const capped = segments.slice(0, 500);
  const lines = capped
    .map((s) => `[${s.start.toFixed(1)}-${s.end.toFixed(1)}] ${s.text.trim()}`)
    .join('\n');

  const body = lines || transcript.slice(0, 12000);

  const system = `You are a short-form video producer. From a timestamped transcript, pick the ${max} BEST moments to cut into standalone short-form clips (15-75 seconds each) for TikTok/Reels/Shorts.
Each clip must be self-contained, start on a strong hook, and end on a natural beat.
Respond with ONLY a JSON array, no prose, of objects:
[{"title": string (<=70 chars, punchy), "start": number (seconds), "end": number (seconds), "excerpt": string (the transcript text of the clip), "reason": string (why it works as a short)}]
Use timestamps from the transcript. Keep end-start between 15 and 75 seconds.`;

  const resp = await askClaude(system, body, 2048, 'claude-sonnet-4-6');
  if (!resp) return null;
  const parsed = parseClaudeJson(resp);
  if (!parsed) return null;
  return parsed.map((c) => {
    let { start, end } = c;
    if (end <= start) end = start + 30;
    if (end - start > MAX_CLIP) end = start + MAX_CLIP;
    return { ...c, start: clamp(start, 0, Infinity), end: clamp(end, start + MIN_CLIP, Infinity) };
  });
}

async function claudeFromText(transcript: string, max: number): Promise<ShortSuggestion[] | null> {
  const system = `You are a short-form video producer. From this transcript (no timestamps available), pick the ${max} BEST self-contained moments to turn into short-form clips/scripts.
Respond with ONLY a JSON array, no prose, of objects:
[{"title": string (<=70 chars, punchy), "start": 0, "end": 0, "excerpt": string (the exact transcript text for this clip), "reason": string (why it works as a short)}]`;
  const resp = await askClaude(system, transcript.slice(0, 14000), 2048, 'claude-sonnet-4-6');
  if (!resp) return null;
  return parseClaudeJson(resp);
}

/**
 * Extract short-form clip suggestions from a transcript.
 * Uses Claude when configured; always falls back to a deterministic heuristic.
 */
export async function extractShorts(opts: {
  transcript: string;
  segments?: TranscriptSegment[];
  maxClips?: number;
}): Promise<ShortSuggestion[]> {
  const max = opts.maxClips ?? DEFAULT_MAX;
  const segments = opts.segments ?? [];
  const hasSegments = segments.length > 0;

  if (isClaudeConfigured()) {
    try {
      const ai = hasSegments
        ? await claudeFromSegments(segments, opts.transcript, max)
        : await claudeFromText(opts.transcript, max);
      if (ai && ai.length) return ai.slice(0, max);
    } catch {
      // fall through to heuristic
    }
  }

  return hasSegments
    ? heuristicFromSegments(segments, max)
    : heuristicFromText(opts.transcript, max);
}
