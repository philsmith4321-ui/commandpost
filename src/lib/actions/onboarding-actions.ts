'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { createOnboardingTemplate, deleteOnboardingTemplate, startOnboarding, toggleOnboardingItem } from '@/lib/queries/onboarding-queries';

export async function createOnboardingTemplateAction(formData: FormData) {
  const db = getDb();
  const name = formData.get('name') as string;
  const itemsRaw = formData.get('items') as string;
  const items = itemsRaw.split('\n').map(s => s.trim()).filter(Boolean);
  if (!name || items.length === 0) return;

  createOnboardingTemplate(db, name, items);
  revalidatePath('/onboarding');
}

export async function deleteOnboardingTemplateAction(formData: FormData) {
  const db = getDb();
  deleteOnboardingTemplate(db, Number(formData.get('id')));
  revalidatePath('/onboarding');
}

export async function startOnboardingAction(formData: FormData) {
  const db = getDb();
  const clientId = Number(formData.get('client_id'));
  const templateId = Number(formData.get('template_id'));
  startOnboarding(db, clientId, templateId);
  revalidatePath(`/clients/${clientId}`);
}

export async function toggleOnboardingItemAction(formData: FormData) {
  const db = getDb();
  const itemId = Number(formData.get('item_id'));
  const clientId = Number(formData.get('client_id'));
  toggleOnboardingItem(db, itemId);
  revalidatePath(`/clients/${clientId}`);
}
