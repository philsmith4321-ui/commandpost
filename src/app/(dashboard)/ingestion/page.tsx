import { getDb } from '@/lib/db';
import { listKbDocuments, kbStats } from '@/lib/queries/kb-queries';
import { IngestionHub } from '@/components/ingestion-hub';

export const dynamic = 'force-dynamic';

export default async function IngestionPage() {
  const db = getDb();
  const documents = listKbDocuments(db);
  const stats = kbStats(db);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-start gap-3 mb-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-xl">⬇</div>
        <div>
          <h2 className="text-2xl font-bold">Ingestion</h2>
          <p className="text-sm text-gray-400">Pull content into CommandPost — media to the Video library, everything else to the knowledge base</p>
        </div>
      </div>

      <IngestionHub initialDocuments={documents} initialStats={stats} />
    </div>
  );
}
