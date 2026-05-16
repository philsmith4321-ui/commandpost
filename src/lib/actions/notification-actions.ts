'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { markNotificationRead, markAllRead, upsertPreference } from '@/lib/queries/notification-queries';
import type { NotificationType, EmailDelivery } from '@/lib/types';

export async function markNotificationReadAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  markNotificationRead(db, id);
  revalidatePath('/notifications');
}

export async function markAllNotificationsReadAction() {
  const db = getDb();
  markAllRead(db);
  revalidatePath('/notifications');
}

export async function updateNotificationPreferenceAction(formData: FormData) {
  const db = getDb();
  const type = formData.get('notification_type') as NotificationType;
  const delivery = formData.get('email_delivery') as EmailDelivery;
  upsertPreference(db, type, delivery);
  revalidatePath('/settings/notifications');
}
