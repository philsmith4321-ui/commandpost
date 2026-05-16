'use server';

import { getDb } from '@/lib/db';
import { createGoal, deleteGoal } from '@/lib/queries/goal-queries';
import { revalidatePath } from 'next/cache';

export async function createGoalAction(formData: FormData) {
  const db = getDb();
  const title = formData.get('title') as string;
  const target_value = Number(formData.get('target_value'));
  const unit = formData.get('unit') as string;
  const period = formData.get('period') as string;
  const period_start = formData.get('period_start') as string;
  const period_end = formData.get('period_end') as string;

  createGoal(db, { title, target_value, unit, period, period_start, period_end });
  revalidatePath('/goals');
}

export async function deleteGoalAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  deleteGoal(db, id);
  revalidatePath('/goals');
}
