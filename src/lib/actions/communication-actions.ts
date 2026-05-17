'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { createCommunication, deleteCommunication } from '@/lib/queries/communication-queries';

export async function addCommunicationAction(formData: FormData) {
  const db = getDb();
  const clientId = Number(formData.get('client_id'));
  createCommunication(db, {
    client_id: clientId,
    comm_type: formData.get('comm_type') as string,
    subject: formData.get('subject') as string,
    body: (formData.get('body') as string) || null,
    comm_date: (formData.get('comm_date') as string) || undefined,
  });
  revalidatePath(`/clients/${clientId}`);
}

export async function deleteCommunicationAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  const clientId = Number(formData.get('client_id'));
  deleteCommunication(db, id);
  revalidatePath(`/clients/${clientId}`);
}
