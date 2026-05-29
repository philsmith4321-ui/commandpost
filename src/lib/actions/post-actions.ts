'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import {
  createPost,
  updatePost,
  deletePost,
  upsertVariant,
  setVariantStatus,
  syncPostPosted,
} from '@/lib/queries/post-queries';
import { generatePostVariants } from '@/lib/content-generator';
import { type Platform, PLATFORM_ORDER } from '@/lib/platforms';
import type { PostStatus } from '@/lib/types';

function readStatus(formData: FormData): PostStatus {
  const value = formData.get('status') as string;
  const allowed: PostStatus[] = ['draft', 'scheduled', 'posted', 'archived'];
  return allowed.includes(value as PostStatus) ? (value as PostStatus) : 'draft';
}

export async function createPostAction(formData: FormData) {
  const db = getDb();
  const title = ((formData.get('title') as string) || '').trim();
  if (!title) return;

  const variants = PLATFORM_ORDER.filter((p) => formData.get(`enabled_${p}`) === 'on').map((p) => ({
    platform: p as Platform,
    content: (formData.get(`content_${p}`) as string) || '',
    enabled: true,
  }));
  if (variants.length === 0) return;

  const id = createPost(db, {
    title,
    idea: ((formData.get('idea') as string) || '').trim() || null,
    image_path: (formData.get('image_path') as string) || null,
    status: readStatus(formData),
    scheduled_at: (formData.get('scheduled_at') as string) || null,
    variants,
  });

  revalidatePath('/content');
  redirect(`/content/${id}`);
}

export async function updatePostAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  const title = ((formData.get('title') as string) || '').trim();
  if (!id || !title) return;

  updatePost(db, id, {
    title,
    idea: ((formData.get('idea') as string) || '').trim() || null,
    image_path: (formData.get('image_path') as string) || null,
    status: readStatus(formData),
    scheduled_at: (formData.get('scheduled_at') as string) || null,
  });

  for (const p of PLATFORM_ORDER) {
    upsertVariant(db, id, p, {
      enabled: formData.get(`enabled_${p}`) === 'on',
      content: (formData.get(`content_${p}`) as string) || '',
    });
  }

  revalidatePath('/content');
  revalidatePath(`/content/${id}`);
  redirect(`/content/${id}`);
}

export async function deletePostAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  if (!id) return;
  deletePost(db, id);
  revalidatePath('/content');
  redirect('/content');
}

export async function markVariantPostedAction(formData: FormData) {
  const db = getDb();
  const variantId = Number(formData.get('variant_id'));
  const postId = Number(formData.get('post_id'));
  if (!variantId || !postId) return;

  setVariantStatus(db, variantId, 'posted', { published_at: new Date().toISOString() });
  syncPostPosted(db, postId);

  revalidatePath('/content');
  revalidatePath(`/content/${postId}`);
}

export async function generateVariantsAction(input: {
  idea: string;
  platforms: Platform[];
  tone: string;
}): Promise<{ variants: Record<Platform, string> } | { error: string }> {
  return generatePostVariants(input);
}
