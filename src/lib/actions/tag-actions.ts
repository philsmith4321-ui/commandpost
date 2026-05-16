'use server';

import { getDb } from '@/lib/db';
import { createTag, addTagToClient, removeTagFromClient, deleteTag } from '@/lib/queries/tag-queries';
import { revalidatePath } from 'next/cache';

export async function createTagAction(formData: FormData) {
  const db = getDb();
  const name = (formData.get('name') as string).trim();
  const color = (formData.get('color') as string) || 'gray';
  if (!name) return;
  createTag(db, name, color);
  revalidatePath('/clients');
}

export async function addTagToClientAction(formData: FormData) {
  const db = getDb();
  const clientId = Number(formData.get('client_id'));
  const tagId = Number(formData.get('tag_id'));
  addTagToClient(db, clientId, tagId);
  revalidatePath(`/clients/${clientId}`);
}

export async function removeTagFromClientAction(formData: FormData) {
  const db = getDb();
  const clientId = Number(formData.get('client_id'));
  const tagId = Number(formData.get('tag_id'));
  removeTagFromClient(db, clientId, tagId);
  revalidatePath(`/clients/${clientId}`);
}

export async function deleteTagAction(formData: FormData) {
  const db = getDb();
  const tagId = Number(formData.get('tag_id'));
  deleteTag(db, tagId);
  revalidatePath('/clients');
}
