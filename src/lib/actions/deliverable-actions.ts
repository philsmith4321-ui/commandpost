'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import {
  createDeliverable,
  updateDeliverableStatus,
  deleteDeliverable,
} from '@/lib/queries/project-queries';
import type { DeliverableStatus } from '@/lib/types';

export async function addDeliverableAction(formData: FormData) {
  const db = getDb();
  const projectId = Number(formData.get('project_id'));
  const clientId = Number(formData.get('client_id'));
  const title = formData.get('title') as string;
  const dueDate = (formData.get('due_date') as string) || null;

  createDeliverable(db, {
    project_id: projectId,
    title,
    due_date: dueDate,
  });

  revalidatePath(`/clients/${clientId}/projects/${projectId}`);
}

export async function updateDeliverableStatusAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  const status = formData.get('status') as DeliverableStatus;
  const clientId = formData.get('client_id') as string | null;
  const projectId = formData.get('project_id') as string | null;

  updateDeliverableStatus(db, id, status);

  if (clientId && projectId) {
    revalidatePath(`/clients/${clientId}/projects/${projectId}`);
  }
  revalidatePath('/board');
}

export async function deleteDeliverableAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  const clientId = Number(formData.get('client_id'));
  const projectId = Number(formData.get('project_id'));

  deleteDeliverable(db, id);

  revalidatePath(`/clients/${clientId}/projects/${projectId}`);
}
