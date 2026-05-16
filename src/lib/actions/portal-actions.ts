'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { generatePortalToken, resetPortalToken } from '@/lib/queries/portal-queries';

export async function generatePortalTokenAction(formData: FormData) {
  const db = getDb();
  const clientId = Number(formData.get('client_id'));
  generatePortalToken(db, clientId);
  revalidatePath(`/clients/${clientId}`);
}

export async function resetPortalTokenAction(formData: FormData) {
  const db = getDb();
  const clientId = Number(formData.get('client_id'));
  resetPortalToken(db, clientId);
  revalidatePath(`/clients/${clientId}`);
}
