import { getDb } from '@/lib/db';
import { listAvatars } from '@/lib/queries/avatar-queries';
import { AvatarManager } from '@/components/avatar-manager';

export const dynamic = 'force-dynamic';

export default async function AvatarsPage() {
  const db = getDb();
  const avatars = listAvatars(db);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-start gap-3 mb-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pink-600 text-xl">👥</div>
        <div>
          <h2 className="text-2xl font-bold">Avatars</h2>
          <p className="text-sm text-gray-400">Audience personas you can target when generating content</p>
        </div>
      </div>

      <AvatarManager initialAvatars={avatars} />
    </div>
  );
}
