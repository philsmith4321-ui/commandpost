import { getDb } from '@/lib/db';
import { listMediaItemsWithClips } from '@/lib/queries/media-queries';
import { VideoStudio } from '@/components/video-studio';

export const dynamic = 'force-dynamic';

export default async function RadioVideoPage() {
  const db = getDb();
  const items = listMediaItemsWithClips(db);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-start gap-3 mb-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-xl">✂</div>
        <div>
          <h2 className="text-2xl font-bold">Radio/Video Edits</h2>
          <p className="text-sm text-gray-400">Extract short-form clips from radio &amp; video content</p>
        </div>
      </div>

      <VideoStudio initialItems={items} />
    </div>
  );
}
