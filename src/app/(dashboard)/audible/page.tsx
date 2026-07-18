import { getDb } from '@/lib/db';
import { listAudibleKbDocuments, listAudibleStories, storyThemeCounts } from '@/lib/queries/kb-queries';
import { listGenerations } from '@/lib/queries/generation-queries';
import { audibleDocLabel, groupAudibleDocsByLabel, STORY_THEMES } from '@/lib/audible';
import { AudibleWorkspace } from '@/components/audible-workspace';

export const dynamic = 'force-dynamic';

export default async function AudiblePage() {
  const db = getDb();
  const docs = listAudibleKbDocuments(db);
  // One shared grouping (groupAudibleDocsByLabel) feeds both this page and the
  // generate route's resolution, so any label rendered here is resolvable
  // there. Deduped — an orphaned duplicate doc (failed sync DELETE) must not
  // render twice. Story docs are handled separately (grouped by theme).
  const categories = new Set<string>();
  const books = new Set<string>();
  // label -> author(s), from the kb_documents.author column (synced from
  // audible-kb frontmatter) — lets the Books filter match author names.
  const bookAuthors: Record<string, string> = {};
  for (const [label, { doc, isBook }] of groupAudibleDocsByLabel(docs)) {
    (isBook ? books : categories).add(label);
    if (isBook && doc.author) bookAuthors[label] = doc.author;
  }

  // Stories, grouped by theme for the browse tab and offered as drafting sources.
  const storyDocs = listAudibleStories(db);
  const stories = storyDocs.map((d) => ({
    id: d.id,
    label: audibleDocLabel(d.title).label,
    theme: d.theme ?? 'Uncategorized',
  }));
  const counts = new Map(storyThemeCounts(db).map((r) => [r.theme, r.count]));
  const storyThemes = STORY_THEMES.filter((t) => (counts.get(t) ?? 0) > 0).map((theme) => ({
    theme,
    count: counts.get(theme) ?? 0,
  }));

  const history = listGenerations(db, 'audible');

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-start gap-3 mb-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-xl">🎧</div>
        <div>
          <h2 className="text-2xl font-bold">Phil&apos;s Audible AI</h2>
          <p className="text-sm text-gray-400">Create content grounded in your Audible library and personal stories</p>
        </div>
      </div>

      <AudibleWorkspace
        categories={Array.from(categories)}
        books={Array.from(books).sort()}
        bookAuthors={bookAuthors}
        storyThemes={storyThemes}
        stories={stories}
        initialHistory={history}
      />
    </div>
  );
}
