'use server';

import { getDb } from '@/lib/db';
import { createRecurringTask, toggleRecurringTask, deleteRecurringTask } from '@/lib/queries/recurring-task-queries';
import { revalidatePath } from 'next/cache';

export async function createRecurringTaskAction(formData: FormData) {
  const db = getDb();
  const client_id = Number(formData.get('client_id'));
  const project_id = formData.get('project_id') ? Number(formData.get('project_id')) : undefined;
  const title = formData.get('title') as string;
  const frequency = formData.get('frequency') as string;
  const day_of_week = formData.get('day_of_week') ? Number(formData.get('day_of_week')) : undefined;
  const day_of_month = formData.get('day_of_month') ? Number(formData.get('day_of_month')) : undefined;

  createRecurringTask(db, { client_id, project_id, title, frequency, day_of_week, day_of_month });
  revalidatePath('/recurring');
}

export async function toggleRecurringTaskAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  toggleRecurringTask(db, id);
  revalidatePath('/recurring');
}

export async function deleteRecurringTaskAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  deleteRecurringTask(db, id);
  revalidatePath('/recurring');
}
