'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { createClientDocument, deleteClientDocument } from '@/lib/queries/document-queries';

export async function addDocumentAction(formData: FormData) {
  const db = getDb();
  const clientId = Number(formData.get('client_id'));
  const docType = (formData.get('doc_type') as 'note' | 'link' | 'file') || 'note';

  createClientDocument(db, {
    client_id: clientId,
    title: formData.get('title') as string,
    doc_type: docType,
    content: (formData.get('content') as string) || null,
    url: (formData.get('url') as string) || null,
  });

  revalidatePath(`/clients/${clientId}`);
}

export async function deleteDocumentAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  const clientId = Number(formData.get('client_id'));
  deleteClientDocument(db, id);
  revalidatePath(`/clients/${clientId}`);
}
