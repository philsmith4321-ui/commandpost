import Link from 'next/link';
import { getDb } from '@/lib/db';
import { listPosts } from '@/lib/queries/post-queries';
import { PlatformBadge } from '@/components/platform-badge';
import { StatusBadge } from '@/components/status-badge';

const TABS = ['all', 'draft', 'scheduled', 'posted', 'archived'];

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = status || 'all';
  const db = getDb();
  const posts = listPosts(db, active);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Content</h2>
        <Link
          href="/content/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          New Post
        </Link>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map((tab) => (
          <Link
            key={tab}
            href={tab === 'all' ? '/content' : `/content?status=${tab}`}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${
              active === tab ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-800'
            }`}
          >
            {tab}
          </Link>
        ))}
      </div>

      {posts.length === 0 ? (
        <p className="text-gray-500">No posts yet. Create your first one.</p>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/content/${post.id}`}
              className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors"
            >
              <div className="min-w-0">
                <p className="font-medium text-white truncate">{post.title}</p>
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {post.platforms.map((p) => (
                    <PlatformBadge key={p} platform={p} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-3">
                {post.scheduled_at && (
                  <span className="text-xs text-gray-500">{post.scheduled_at}</span>
                )}
                <StatusBadge status={post.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
