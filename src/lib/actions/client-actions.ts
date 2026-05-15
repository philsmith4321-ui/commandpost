'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import {
  createClient,
  updateClient,
  softDeleteClient,
} from '@/lib/queries/client-queries';
import type { ClientStatus } from '@/lib/types';

export async function createClientAction(formData: FormData) {
  const db = getDb();
  const id = createClient(db, {
    name: formData.get('name') as string,
    contact_person: (formData.get('contact_person') as string) || null,
    email: (formData.get('email') as string) || null,
    phone: (formData.get('phone') as string) || null,
    notes: (formData.get('notes') as string) || null,
    source: (formData.get('source') as string) || null,
    status: (formData.get('status') as ClientStatus) || 'active',
    monthly_value: formData.get('monthly_value')
      ? Number(formData.get('monthly_value'))
      : null,
  });

  revalidatePath('/clients');
  redirect(`/clients/${id}`);
}

export async function updateClientAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));

  updateClient(db, id, {
    name: formData.get('name') as string,
    contact_person: (formData.get('contact_person') as string) || null,
    email: (formData.get('email') as string) || null,
    phone: (formData.get('phone') as string) || null,
    notes: (formData.get('notes') as string) || null,
    source: (formData.get('source') as string) || null,
    status: (formData.get('status') as ClientStatus) || 'active',
    monthly_value: formData.get('monthly_value')
      ? Number(formData.get('monthly_value'))
      : null,
  });

  revalidatePath('/clients');
  revalidatePath(`/clients/${id}`);
  redirect(`/clients/${id}`);
}

export async function deleteClientAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  softDeleteClient(db, id);
  revalidatePath('/clients');
  redirect('/clients');
}
