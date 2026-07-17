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

/** Display prefix for Audible KB doc titles (naming convention only — not a fence). */
export const AUDIBLE_TITLE_PREFIX = 'Audible — ';
