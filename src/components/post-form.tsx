'use client';

import { useState, useTransition } from 'react';
import { type Platform, PLATFORMS, PLATFORM_ORDER } from '@/lib/platforms';
import type { PostWithVariants } from '@/lib/types';
import { generateVariantsAction } from '@/lib/actions/post-actions';
import { PostImageUpload } from '@/components/post-image-upload';

const inputClass =
  'w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500';

interface PostFormProps {
  action: (formData: FormData) => Promise<void>;
  post?: PostWithVariants;
  submitLabel: string;
  aiConfigured: boolean;
}

function initialState(post?: PostWithVariants) {
  const enabled = {} as Record<Platform, boolean>;
  const content = {} as Record<Platform, string>;
  for (const p of PLATFORM_ORDER) {
    const variant = post?.variants.find((v) => v.platform === p);
    // New post: default all platforms enabled. Edit: reflect stored rows.
    enabled[p] = post ? !!variant && variant.enabled === 1 : true;
    content[p] = variant?.content ?? '';
  }
  return { enabled, content };
}

export function PostForm({ action, post, submitLabel, aiConfigured }: PostFormProps) {
  const init = initialState(post);
  const [title, setTitle] = useState(post?.title ?? '');
  const [idea, setIdea] = useState(post?.idea ?? '');
  const [enabled, setEnabled] = useState<Record<Platform, boolean>>(init.enabled);
  const [content, setContent] = useState<Record<Platform, string>>(init.content);
  const [image, setImage] = useState<string>(post?.image_path ?? '');
  const [tone, setTone] = useState('');
  const [aiError, setAiError] = useState('');
  const [pending, startTransition] = useTransition();

  const selectedPlatforms = PLATFORM_ORDER.filter((p) => enabled[p]);
  const instagramNeedsImage = enabled.instagram && !image;
  const canSubmit = title.trim().length > 0 && selectedPlatforms.length > 0 && !instagramNeedsImage;

  function handleGenerate() {
    setAiError('');
    startTransition(async () => {
      const result = await generateVariantsAction({ idea, platforms: selectedPlatforms, tone });
      if ('error' in result) {
        setAiError(result.error);
        return;
      }
      setContent((prev) => {
        const next = { ...prev };
        for (const p of selectedPlatforms) {
          if (result.variants[p]) next[p] = result.variants[p];
        }
        return next;
      });
    });
  }

  return (
    <form action={action} className="space-y-6">
      {post && <input type="hidden" name="id" value={post.id} />}

      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">
          Title <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          name="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Internal name for this post"
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">Idea</label>
        <textarea
          name="idea"
          rows={3}
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="What is this post about? Used as the seed for AI generation."
          className={inputClass}
        />
      </div>

      <PostImageUpload value={image} onChange={setImage} />

      <div className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <label className="block text-sm font-medium text-gray-400">Platforms</label>
          {aiConfigured && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                placeholder="Tone (optional)"
                className="px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-white w-40"
              />
              <button
                type="button"
                onClick={handleGenerate}
                disabled={pending || selectedPlatforms.length === 0 || !idea.trim()}
                className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:text-gray-400 text-white font-medium rounded-lg transition-colors"
              >
                {pending ? 'Generating...' : 'Generate with AI'}
              </button>
            </div>
          )}
        </div>

        {aiError && (
          <div className="p-3 bg-red-900/10 border border-red-900 rounded-lg text-sm text-red-400">
            {aiError}
          </div>
        )}

        {PLATFORM_ORDER.map((p) => {
          const cfg = PLATFORMS[p];
          const over = content[p].length > cfg.charLimit;
          return (
            <div key={p} className="border border-gray-800 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 text-sm font-medium text-white">
                  <input
                    type="checkbox"
                    name={`enabled_${p}`}
                    checked={enabled[p]}
                    onChange={(e) => setEnabled((prev) => ({ ...prev, [p]: e.target.checked }))}
                  />
                  <span className="font-bold">{cfg.icon}</span> {cfg.label}
                </label>
                <span className={`text-xs ${over ? 'text-red-400' : 'text-gray-500'}`}>
                  {content[p].length} / {cfg.charLimit}
                </span>
              </div>
              {/* Always submit content so disabling a platform preserves its text */}
              <textarea
                name={`content_${p}`}
                rows={3}
                value={content[p]}
                onChange={(e) => setContent((prev) => ({ ...prev, [p]: e.target.value }))}
                placeholder={`${cfg.label} post text`}
                className={`${inputClass} ${enabled[p] ? '' : 'hidden'}`}
              />
            </div>
          );
        })}

        {instagramNeedsImage && (
          <p className="text-xs text-red-400">Instagram requires an image. Upload one above.</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Status</label>
          <select name="status" defaultValue={post?.status ?? 'draft'} className={inputClass}>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="posted">Posted</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Scheduled date</label>
          <input
            type="date"
            name="scheduled_at"
            defaultValue={post?.scheduled_at ?? ''}
            className={inputClass}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:text-gray-400 text-white font-medium rounded-lg transition-colors"
      >
        {submitLabel}
      </button>
    </form>
  );
}
