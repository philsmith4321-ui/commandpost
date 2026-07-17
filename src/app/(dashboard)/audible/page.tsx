import { getDb } from '@/lib/db';
import { listAudibleKbDocuments } from '@/lib/queries/kb-queries';
import { listGenerations } from '@/lib/queries/generation-queries';
import { AUDIBLE_TITLE_PREFIX } from '@/lib/audible';
import { AudibleStudio } from '@/components/audible-studio';

export const dynamic = 'force-dynamic';

export default async function AudiblePage() {
  const db = getDb();
  const docs = listAudibleKbDocuments(db);
  // Category labels: titles minus the display prefix ('Audible — Business' → 'Business').
  const categories = docs.map((d) =>
    d.title.startsWith(AUDIBLE_TITLE_PREFIX) ? d.title.slice(AUDIBLE_TITLE_PREFIX.length) : d.title
  );
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

      <AudibleStudio categories={categories} initialHistory={history} />
    </div>
  );
}
