/**
 * Ingest Phil's personal stories into the Audible KB as story documents.
 *
 * Source: data/audible-stories.json (gitignored — personal content stays out
 * of the repo, like the book-note content). Each entry becomes one
 * kb_document (doc_set='audible', title 'Audible Story — <label>', theme=<one
 * of STORY_THEMES>) plus retrieval chunks.
 *
 * Idempotent: every run first deletes existing Audible story docs, then
 * re-ingests. Safe to re-run after the JSON changes.
 *
 *   npx tsx scripts/ingest-audible-stories.ts [path-to-json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../src/lib/db';
import { createKbDocument, deleteAudibleStories } from '../src/lib/queries/kb-queries';
import { indexDocument } from '../src/lib/ingestion/index-document';
import { AUDIBLE_DOC_SET, AUDIBLE_STORY_TITLE_PREFIX, isStoryTheme } from '../src/lib/audible';

interface StoryRecord {
  theme: string;
  label: string;
  source?: string;
  source_ref?: string;
  text: string;
}

function main() {
  const jsonPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(process.cwd(), 'data', 'audible-stories.json');

  if (!fs.existsSync(jsonPath)) {
    console.error(`Story dataset not found: ${jsonPath}`);
    process.exit(1);
  }

  const records = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as StoryRecord[];
  if (!Array.isArray(records) || records.length === 0) {
    console.error('Story dataset is empty or not an array.');
    process.exit(1);
  }

  // Validate every record up front — a bad theme must not silently ingest untagged.
  const bad = records.filter((r) => !r?.label || !r?.text || !isStoryTheme(r?.theme));
  if (bad.length > 0) {
    console.error(`${bad.length} record(s) have a missing label/text or an unknown theme. Aborting.`);
    for (const b of bad.slice(0, 5)) console.error('  -', JSON.stringify({ theme: b?.theme, label: b?.label }));
    process.exit(1);
  }

  const db = getDb();
  const removed = deleteAudibleStories(db);
  if (removed > 0) console.log(`Removed ${removed} existing story doc(s) for a clean re-ingest.`);

  let ingested = 0;
  const byTheme: Record<string, number> = {};
  for (const r of records) {
    const id = createKbDocument(db, {
      title: `${AUDIBLE_STORY_TITLE_PREFIX}${r.label}`,
      source_type: 'text',
      source_url: r.source_ref ? `story:${r.source ?? 'unknown'}:${r.source_ref}` : null,
      content: r.text,
      doc_set: AUDIBLE_DOC_SET,
      theme: r.theme,
    });
    indexDocument(db, id, r.text);
    ingested += 1;
    byTheme[r.theme] = (byTheme[r.theme] ?? 0) + 1;
  }

  console.log(`\nIngested ${ingested} stories into the Audible KB:`);
  for (const [theme, n] of Object.entries(byTheme)) console.log(`  ${String(n).padStart(3)}  ${theme}`);
}

main();
