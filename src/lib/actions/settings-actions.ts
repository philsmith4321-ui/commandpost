'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { setSetting, SETTING_KEYS } from '@/lib/queries/settings-queries';

export async function saveSettingsAction(formData: FormData) {
  const db = getDb();
  for (const { key } of SETTING_KEYS) {
    const value = formData.get(key) as string;
    if (value !== null && value !== undefined) {
      setSetting(db, key, value);
    }
  }
  revalidatePath('/settings');
}
