'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { createMilestone, updateMilestoneStatus, deleteMilestone } from '@/lib/queries/milestone-queries';

export async function createMilestoneAction(formData: FormData) {
  const db = getDb();
  createMilestone(db, {
    project_id: Number(formData.get('project_id')),
    title: formData.get('title') as string,
    start_date: formData.get('start_date') as string,
    end_date: formData.get('end_date') as string,
    color: (formData.get('color') as string) || 'blue',
  });
  revalidatePath('/projects');
  revalidatePath('/projects/timeline');
}

export async function updateMilestoneStatusAction(formData: FormData) {
  const db = getDb();
  updateMilestoneStatus(db, Number(formData.get('id')), formData.get('status') as string);
  revalidatePath('/projects');
  revalidatePath('/projects/timeline');
}

export async function deleteMilestoneAction(formData: FormData) {
  const db = getDb();
  deleteMilestone(db, Number(formData.get('id')));
  revalidatePath('/projects');
  revalidatePath('/projects/timeline');
}
