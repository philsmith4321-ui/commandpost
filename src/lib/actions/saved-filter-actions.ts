'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { createSavedFilter, deleteSavedFilter } from '@/lib/queries/saved-filter-queries';

export async function createSavedFilterAction(formData: FormData) {
  const db = getDb();
  const name = formData.get('name') as string;
  const page = formData.get('page') as string;
  const params = formData.get('params') as string;
  if (!name || !page) return;
  createSavedFilter(db, { name, page, params: params || '' });
  revalidatePath(page);
}

export async function deleteSavedFilterAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  const page = formData.get('page') as string;
  deleteSavedFilter(db, id);
  revalidatePath(page || '/');
}
