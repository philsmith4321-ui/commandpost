'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { logEmail } from '@/lib/queries/email-log-queries';

export async function logEmailAction(formData: FormData) {
  const db = getDb();
  const clientId = formData.get('client_id') ? Number(formData.get('client_id')) : null;

  logEmail(db, {
    client_id: clientId,
    recipient_email: formData.get('recipient_email') as string,
    subject: formData.get('subject') as string,
    email_type: (formData.get('email_type') as string) || 'other',
    reference_id: formData.get('reference_id') ? Number(formData.get('reference_id')) : null,
  });

  revalidatePath('/emails');
  if (clientId) revalidatePath(`/clients/${clientId}`);
}
