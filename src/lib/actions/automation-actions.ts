'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { createAutomation, toggleAutomation, deleteAutomation } from '@/lib/queries/automation-queries';

export async function createAutomationAction(formData: FormData) {
  const db = getDb();
  createAutomation(db, {
    name: formData.get('name') as string,
    trigger_type: formData.get('trigger_type') as string,
    trigger_value: (formData.get('trigger_value') as string) || null,
    action_type: formData.get('action_type') as string,
    action_config: (formData.get('action_config') as string) || null,
  });
  revalidatePath('/automations');
}

export async function toggleAutomationAction(formData: FormData) {
  const db = getDb();
  toggleAutomation(db, Number(formData.get('id')));
  revalidatePath('/automations');
}

export async function deleteAutomationAction(formData: FormData) {
  const db = getDb();
  deleteAutomation(db, Number(formData.get('id')));
  revalidatePath('/automations');
}
