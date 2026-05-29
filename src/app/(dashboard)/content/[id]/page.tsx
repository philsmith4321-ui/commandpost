import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getPostById } from '@/lib/queries/post-queries';
import { updatePostAction, deletePostAction, markVariantPostedAction } from '@/lib/actions/post-actions';
import { isClaudeConfigured } from '@/lib/claude';
import { PostForm } from '@/components/post-form';
import { PlatformBadge } from '@/components/platform-badge';
import { CopyButton } from '@/components/copy-button';

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const post = getPostById(db, Number(id));
  if (!post) notFound();

  const enabledVariants = post.variants.filter((v) => v.enabled === 1);

  return (
    <div className="p-4 sm:p-6 max-w-3xl">
      <Link href="/content" className="text-sm text-gray-400 hover:text-white mb-4 inline-block">
        &larr; Back to Content
      </Link>
      <h2 className="text-2xl font-bold mb-6">{post.title}</h2>

      <PostForm
        action={updatePostAction}
        post={post}
        submitLabel="Save Changes"
        aiConfigured={isClaudeConfigured()}
      />

      <div className="mt-10">
        <h3 className="text-sm font-medium text-gray-400 uppercase mb-3">Publish</h3>
        <p className="text-xs text-gray-500 mb-4">
          Copy each post and paste it into the network. Auto-publishing to platform APIs is coming in a
          future update.
        </p>
        {post.image_path && (
          <a
            href={`/api/content/image/${post.image_path}`}
            download
            className="inline-block mb-4 text-sm text-blue-400 hover:underline"
          >
            Download image
          </a>
        )}
        <div className="space-y-3">
          {enabledVariants.map((v) => (
            <div key={v.id} className="p-3 bg-gray-900 border border-gray-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <PlatformBadge platform={v.platform} />
                  {v.status === 'posted' && <span className="text-xs text-green-400">Posted</span>}
                </div>
                <div className="flex items-center gap-2">
                  <CopyButton text={v.content} />
                  {v.status !== 'posted' && (
                    <form action={markVariantPostedAction}>
                      <input type="hidden" name="variant_id" value={v.id} />
                      <input type="hidden" name="post_id" value={post.id} />
                      <button
                        type="submit"
                        className="px-3 py-1 text-xs text-gray-400 hover:text-white border border-gray-700 rounded hover:border-gray-600 transition-colors"
                      >
                        Mark posted
                      </button>
                    </form>
                  )}
                </div>
              </div>
              <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans">
                {v.content || <span className="text-gray-600">No content</span>}
              </pre>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 pt-6 border-t border-gray-800">
        <form action={deletePostAction}>
          <input type="hidden" name="id" value={post.id} />
          <button type="submit" className="text-sm text-red-400 hover:text-red-300">
            Delete post
          </button>
        </form>
      </div>
    </div>
  );
}
