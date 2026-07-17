import { getDb } from '@/lib/db';
import { listAudibleKbDocuments } from '@/lib/queries/kb-queries';
import { listGenerations } from '@/lib/queries/generation-queries';
import { audibleDocLabel } from '@/lib/audible';
import { AudibleStudio } from '@/components/audible-studio';

export const dynamic = 'force-dynamic';

export default async function AudiblePage() {
  const db = getDb();
  const docs = listAudibleKbDocuments(db);
  // Section + label per doc via the shared helper (the generate route resolves
  // with the same logic, keeping the newest doc per label). Deduped — an
  // orphaned duplicate doc (failed sync DELETE) must not render twice.
  const categories = new Set<string>();
  const books = new Set<string>();
  for (const d of docs) {
    const { label, isBook } = audibleDocLabel(d.title);
    (isBook ? books : categories).add(label);
  }
  const history = listGenerations(db, 'audible');

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-start gap-3 mb-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-xl">🎧</div>
        <div>
          <h2 className="text-2xl font-bold">Phil&apos;s Audible AI</h2>
          <p className="text-sm text-gray-400">Create content grounded in your Audible book library</p>
        </div>
      </div>

      <AudibleStudio categories={Array.from(categories)} books={Array.from(books).sort()} initialHistory={history} />
    </div>
  );
}
