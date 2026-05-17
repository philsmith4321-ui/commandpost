'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { snoozeFollowUp } from '@/lib/queries/followup-queries';

export async function snoozeFollowUpAction(formData: FormData) {
  const db = getDb();
  const leadId = Number(formData.get('lead_id'));
  const days = Number(formData.get('days')) || 3;
  snoozeFollowUp(db, leadId, days);
  revalidatePath('/pipeline');
  revalidatePath('/pipeline/followups');
}
