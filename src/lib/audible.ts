/**
 * Constants for the "Phil's Audible AI" doc set.
 *
 * The fence that keeps Audible KB docs and generations out of every
 * ReKindleLeads-facing surface is the `kb_documents.doc_set` column (and
 * `generations.kind`) — NOT titles. The title prefix below is a
 * display/naming convention only; never filter on it.
 */

/** Value stored in `kb_documents.doc_set` for Audible KB documents. */
export const AUDIBLE_DOC_SET = 'audible';

/** Display prefix for Audible theme/profile doc titles (naming convention only — not a fence). */
export const AUDIBLE_TITLE_PREFIX = 'Audible — ';

/** Display prefix for Audible book deep-note titles (naming convention only — not a fence). */
export const AUDIBLE_BOOK_TITLE_PREFIX = 'Audible Book — ';

/** Display prefix for Audible personal-story titles (naming convention only — not a fence). */
export const AUDIBLE_STORY_TITLE_PREFIX = 'Audible Story — ';

/**
 * The 15 story themes, in display order. Story docs carry one of these in
 * `kb_documents.theme`; the Stories tab groups by it and the generate route
 * resolves a selected story theme to every story doc that carries it.
 */
export const STORY_THEMES = [
  'Family history & upbringing',
  'Calling into ministry',
  'Marriage & Amy',
  'Kids & parenting',
  'Cars, trucks & driving',
  'The outdoors, sports & hobbies',
  'Friends & pastoral care',
  'Health, mental health & hard seasons',
  'Faith, conversion & testimonies',
  'Teaching illustrations & notable lives',
  'Scripture & Bible stories',
  'Work, business & building',
  'Kindness, community & everyday grace',
  'Humor & lighter moments',
  'Funerals & Celebrations of Life',
] as const;

export type StoryTheme = (typeof STORY_THEMES)[number];

export function isStoryTheme(value: unknown): value is StoryTheme {
  return typeof value === 'string' && (STORY_THEMES as readonly string[]).includes(value);
}

/**
 * Derive the display label and section (theme / book / story) for an audible-set
 * doc. The page and the generate route both use this, so any doc the page lists
 * is guaranteed resolvable by the route. Prefixes are non-overlapping; a title
 * matching none falls through as a theme-section label of the full title.
 */
export function audibleDocLabel(title: string): { label: string; isBook: boolean; isStory: boolean } {
  if (title.startsWith(AUDIBLE_STORY_TITLE_PREFIX)) {
    return { label: title.slice(AUDIBLE_STORY_TITLE_PREFIX.length), isBook: false, isStory: true };
  }
  if (title.startsWith(AUDIBLE_BOOK_TITLE_PREFIX)) {
    return { label: title.slice(AUDIBLE_BOOK_TITLE_PREFIX.length), isBook: true, isStory: false };
  }
  if (title.startsWith(AUDIBLE_TITLE_PREFIX)) {
    return { label: title.slice(AUDIBLE_TITLE_PREFIX.length), isBook: false, isStory: false };
  }
  return { label: title, isBook: false, isStory: false };
}

/**
 * Books-picker filter predicate: a book chip matches when the query appears
 * in its title OR its author(s) (case-insensitive substring, so first or
 * last names both hit). Books absent from the author map fall back to
 * title-only matching; a blank query matches everything.
 */
export function matchesBookFilter(
  label: string,
  query: string,
  authors: Record<string, string>
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (label.toLowerCase().includes(q)) return true;
  return (authors[label] ?? '').toLowerCase().includes(q);
}

/**
 * Group non-story audible docs by display label, keeping the FIRST doc per
 * label. Callers pass listAudibleKbDocuments' newest-first order, so an
 * orphaned older duplicate (failed sync DELETE) never wins. The page derives
 * its theme/book pickers from this and the generate route resolves selections
 * through it — one shared grouping is what guarantees any label the page
 * shows is resolvable by the route (AE1).
 */
export function groupAudibleDocsByLabel<T extends { title: string }>(
  docs: T[]
): Map<string, { doc: T; isBook: boolean }> {
  const byLabel = new Map<string, { doc: T; isBook: boolean }>();
  for (const d of docs) {
    const { label, isBook, isStory } = audibleDocLabel(d.title);
    if (isStory) continue;
    if (!byLabel.has(label)) byLabel.set(label, { doc: d, isBook });
  }
  return byLabel;
}
