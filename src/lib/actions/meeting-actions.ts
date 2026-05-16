'use server';

import { getDb } from '@/lib/db';
import { createMeeting } from '@/lib/queries/meeting-queries';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createMeetingAction(formData: FormData) {
  const db = getDb();
  const client_id = Number(formData.get('client_id'));
  const project_id = formData.get('project_id') ? Number(formData.get('project_id')) : undefined;
  const title = formData.get('title') as string;
  const meeting_date = formData.get('meeting_date') as string;
  const duration_minutes = formData.get('duration_minutes') ? Number(formData.get('duration_minutes')) : undefined;
  const notes = formData.get('notes') as string;
  const action_items = formData.get('action_items') as string;

  createMeeting(db, { client_id, project_id, title, meeting_date, duration_minutes, notes, action_items });

  // Also log as activity
  db.prepare('INSERT INTO activity_logs (client_id, project_id, content) VALUES (?, ?, ?)')
    .run(client_id, project_id || null, `Meeting: ${title}`);

  revalidatePath('/meetings');
  revalidatePath(`/clients/${client_id}`);
  redirect('/meetings');
}
