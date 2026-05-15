'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import {
  createProject,
  updateProject,
  deleteProject,
} from '@/lib/queries/project-queries';
import type { ProjectStatus } from '@/lib/types';

export async function createProjectAction(formData: FormData) {
  const db = getDb();
  const clientId = Number(formData.get('client_id'));

  const id = createProject(db, {
    client_id: clientId,
    name: formData.get('name') as string,
    status: (formData.get('status') as ProjectStatus) || 'active',
    start_date: (formData.get('start_date') as string) || null,
    server_ip: (formData.get('server_ip') as string) || null,
    repo_url: (formData.get('repo_url') as string) || null,
    deploy_command: (formData.get('deploy_command') as string) || null,
    stack_notes: (formData.get('stack_notes') as string) || null,
  });

  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}/projects/${id}`);
}

export async function updateProjectAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  const clientId = Number(formData.get('client_id'));

  updateProject(db, id, {
    name: formData.get('name') as string,
    status: (formData.get('status') as ProjectStatus) || 'active',
    start_date: (formData.get('start_date') as string) || null,
    server_ip: (formData.get('server_ip') as string) || null,
    repo_url: (formData.get('repo_url') as string) || null,
    deploy_command: (formData.get('deploy_command') as string) || null,
    stack_notes: (formData.get('stack_notes') as string) || null,
  });

  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/projects/${id}`);
  redirect(`/clients/${clientId}/projects/${id}`);
}

export async function deleteProjectAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  const clientId = Number(formData.get('client_id'));

  deleteProject(db, id);

  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}
