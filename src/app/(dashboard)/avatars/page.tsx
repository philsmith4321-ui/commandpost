import { getDb } from '@/lib/db';
import { listAvatars } from '@/lib/queries/avatar-queries';
import { getMasterProfile } from '@/lib/queries/master-queries';
import { AvatarManager } from '@/components/avatar-manager';
import { MasterProfileEditor } from '@/components/master-profile-editor';

export const dynamic = 'force-dynamic';

export default async function AvatarsPage() {
  const db = getDb();
  const avatars = listAvatars(db);
  const master = getMasterProfile(db);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-start gap-3 mb-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pink-600 text-xl">👥</div>
        <div>
          <h2 className="text-2xl font-bold">Avatars</h2>
          <p className="text-sm text-gray-400">Master profile (always applied) + one vertical overlay per piece</p>
        </div>
      </div>

      <div className="max-w-3xl space-y-6">
        <MasterProfileEditor initialMaster={master} />
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Vertical overlays</h3>
          <AvatarManager initialAvatars={avatars} />
        </div>
      </div>
    </div>
  );
}
