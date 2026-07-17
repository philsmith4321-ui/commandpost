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

/**
 * Derive the display label and section (theme vs book) for an audible-set doc.
 * The page and the generate route both use this, so any doc the page lists is
 * guaranteed resolvable by the route. Prefixes are non-overlapping; a title
 * matching neither falls through as a theme-section label of the full title.
 */
export function audibleDocLabel(title: string): { label: string; isBook: boolean } {
  if (title.startsWith(AUDIBLE_BOOK_TITLE_PREFIX)) {
    return { label: title.slice(AUDIBLE_BOOK_TITLE_PREFIX.length), isBook: true };
  }
  if (title.startsWith(AUDIBLE_TITLE_PREFIX)) {
    return { label: title.slice(AUDIBLE_TITLE_PREFIX.length), isBook: false };
  }
  return { label: title, isBook: false };
}
