'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { addScore } from '@/lib/queries/satisfaction-queries';

export async function addSatisfactionScoreAction(formData: FormData) {
  const db = getDb();
  const clientId = Number(formData.get('client_id'));
  const score = Number(formData.get('score'));
  const notes = (formData.get('notes') as string) || undefined;
  if (!clientId || score < 0 || score > 10) return;
  addScore(db, clientId, score, notes);
  revalidatePath('/reports/satisfaction');
  revalidatePath(`/clients/${clientId}`);
}
