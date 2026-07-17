import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { storyDocsForSearch, randomStory } from '@/lib/queries/kb-queries';
import { audibleDocLabel, isStoryTheme } from '@/lib/audible';

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'is', 'are',
  'be', 'this', 'that', 'it', 'as', 'at', 'by', 'from', 'how', 'what', 'why', 'about',
  'story', 'stories', 'about',
]);

function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]{3,}/g) || []).filter((t) => !STOPWORDS.has(t));
}

function score(text: string, terms: string[]): number {
  const lower = text.toLowerCase();
  let n = 0;
  for (const t of terms) {
    let i = lower.indexOf(t);
    while (i !== -1) { n += 1; i = lower.indexOf(t, i + t.length); }
  }
  return n;
}

/**
 * "Pull a story": return one story for the browse tab.
 * - With a query: the best keyword match (optionally scoped to a theme).
 * - Without a query: a random story (optionally scoped to a theme).
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const query = typeof body?.query === 'string' ? body.query.trim() : '';
  const theme = isStoryTheme(body?.theme) ? (body.theme as string) : null;

  const db = getDb();

  if (query) {
    const terms = tokenize(query);
    const candidates = storyDocsForSearch(db, theme);
    if (candidates.length === 0) return NextResponse.json({ error: 'No stories found' }, { status: 404 });
    let best = candidates[0];
    let bestScore = terms.length ? score(best.content, terms) : 0;
    for (const c of candidates.slice(1)) {
      const s = terms.length ? score(c.content, terms) : 0;
      if (s > bestScore) { best = c; bestScore = s; }
    }
    // No keyword hit anywhere → fall back to a random story so the button always returns something.
    if (bestScore === 0) {
      const r = randomStory(db, theme);
      if (!r) return NextResponse.json({ error: 'No stories found' }, { status: 404 });
      const { label } = audibleDocLabel(r.title);
      return NextResponse.json({ id: r.id, label, theme: r.theme, content: r.content, matched: false });
    }
    const { label } = audibleDocLabel(best.title);
    return NextResponse.json({ id: best.id, label, theme: best.theme, content: best.content, matched: true });
  }

  const r = randomStory(db, theme);
  if (!r) return NextResponse.json({ error: 'No stories found' }, { status: 404 });
  const { label } = audibleDocLabel(r.title);
  return NextResponse.json({ id: r.id, label, theme: r.theme, content: r.content, matched: false });
}
