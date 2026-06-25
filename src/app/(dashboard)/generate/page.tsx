import { getDb } from '@/lib/db';
import { listKbDocuments } from '@/lib/queries/kb-queries';
import { listGenerations } from '@/lib/queries/generation-queries';
import { listAvatars } from '@/lib/queries/avatar-queries';
import { GenerateStudio } from '@/components/generate-studio';

export const dynamic = 'force-dynamic';

export default async function GeneratePage() {
  const db = getDb();
  const sources = listKbDocuments(db);
  const history = listGenerations(db);
  const avatars = listAvatars(db);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-start gap-3 mb-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-xl">✦</div>
        <div>
          <h2 className="text-2xl font-bold">Generate</h2>
          <p className="text-sm text-gray-400">Create content grounded in your selected knowledge sources</p>
        </div>
      </div>

      <GenerateStudio initialSources={sources} initialHistory={history} avatars={avatars} />
    </div>
  );
}
