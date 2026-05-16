'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { createEndpoint, updateEndpoint, deleteEndpoint } from '@/lib/queries/endpoint-queries';

export async function createEndpointAction(formData: FormData) {
  const db = getDb();
  const id = createEndpoint(db, {
    name: formData.get('name') as string,
    url: formData.get('url') as string,
    check_interval_seconds: Number(formData.get('check_interval_seconds')) || 300,
    slow_threshold_ms: Number(formData.get('slow_threshold_ms')) || 5000,
    is_active: formData.has('is_active') ? 1 : 0,
  });
  revalidatePath('/ops');
  redirect(`/ops/${id}`);
}

export async function updateEndpointAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  updateEndpoint(db, id, {
    name: formData.get('name') as string,
    url: formData.get('url') as string,
    check_interval_seconds: Number(formData.get('check_interval_seconds')) || 300,
    slow_threshold_ms: Number(formData.get('slow_threshold_ms')) || 5000,
    is_active: formData.has('is_active') ? 1 : 0,
  });
  revalidatePath('/ops');
  redirect(`/ops/${id}`);
}

export async function deleteEndpointAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  deleteEndpoint(db, id);
  revalidatePath('/ops');
  redirect('/ops');
}
