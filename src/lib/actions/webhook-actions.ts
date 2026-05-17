'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { createWebhook, deleteWebhook, toggleWebhook } from '@/lib/queries/webhook-queries';

export async function createWebhookAction(formData: FormData) {
  const db = getDb();
  createWebhook(db, {
    name: formData.get('name') as string,
    url: formData.get('url') as string,
    events: formData.get('events') as string,
    secret: (formData.get('secret') as string) || null,
  });
  revalidatePath('/settings/webhooks');
}

export async function deleteWebhookAction(formData: FormData) {
  const db = getDb();
  deleteWebhook(db, Number(formData.get('id')));
  revalidatePath('/settings/webhooks');
}

export async function toggleWebhookAction(formData: FormData) {
  const db = getDb();
  toggleWebhook(db, Number(formData.get('id')));
  revalidatePath('/settings/webhooks');
}
