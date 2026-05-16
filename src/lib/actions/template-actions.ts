'use server';

import { getDb } from '@/lib/db';
import { createTemplate, addTemplateDeliverable, deleteTemplate, createProjectFromTemplate } from '@/lib/queries/template-queries';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createTemplateAction(formData: FormData) {
  const db = getDb();
  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const stack_notes = formData.get('stack_notes') as string;
  const hourly_rate = formData.get('hourly_rate') ? Number(formData.get('hourly_rate')) : undefined;

  const templateId = createTemplate(db, { name, description, stack_notes, hourly_rate });

  // Parse deliverables from form
  let i = 0;
  while (formData.get(`deliverable_title_${i}`)) {
    const title = formData.get(`deliverable_title_${i}`) as string;
    const daysOffset = Number(formData.get(`deliverable_days_${i}`) || '0');
    if (title.trim()) {
      addTemplateDeliverable(db, templateId, title, daysOffset);
    }
    i++;
  }

  revalidatePath('/templates');
  redirect('/templates');
}

export async function deleteTemplateAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  deleteTemplate(db, id);
  revalidatePath('/templates');
}

export async function createProjectFromTemplateAction(formData: FormData) {
  const db = getDb();
  const templateId = Number(formData.get('template_id'));
  const clientId = Number(formData.get('client_id'));
  const projectName = formData.get('project_name') as string;
  const startDate = formData.get('start_date') as string;

  const projectId = createProjectFromTemplate(db, templateId, clientId, projectName, startDate);
  
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}/projects/${projectId}`);
}
