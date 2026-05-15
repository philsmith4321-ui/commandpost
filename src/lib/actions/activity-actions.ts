'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';

export async function addActivityAction(formData: FormData) {
  const db = getDb();
  const clientId = Number(formData.get('client_id'));
  const projectId = formData.get('project_id') ? Number(formData.get('project_id')) : null;
  const content = formData.get('content') as string;

  db.prepare('INSERT INTO activity_logs (client_id, project_id, content) VALUES (?, ?, ?)').run(clientId, projectId, content);
  db.prepare("UPDATE clients SET updated_at = datetime('now') WHERE id = ?").run(clientId);

  revalidatePath(`/clients/${clientId}`);
  if (projectId) {
    revalidatePath(`/clients/${clientId}/projects/${projectId}`);
  }
}
