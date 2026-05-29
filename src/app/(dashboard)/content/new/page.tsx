import Link from 'next/link';
import { PostForm } from '@/components/post-form';
import { createPostAction } from '@/lib/actions/post-actions';
import { isClaudeConfigured } from '@/lib/claude';

export default function NewPostPage() {
  return (
    <div className="p-4 sm:p-6 max-w-3xl">
      <Link href="/content" className="text-sm text-gray-400 hover:text-white mb-4 inline-block">
        &larr; Back to Content
      </Link>
      <h2 className="text-2xl font-bold mb-6">New Post</h2>
      <PostForm action={createPostAction} submitLabel="Create Post" aiConfigured={isClaudeConfigured()} />
    </div>
  );
}
