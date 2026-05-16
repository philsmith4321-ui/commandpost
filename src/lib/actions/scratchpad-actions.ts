'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { createNote, updateNote, deleteNote, togglePinNote } from '@/lib/queries/scratchpad-queries';

export async function createNoteAction(formData: FormData) {
  const db = getDb();
  const title = formData.get('title') as string;
  const content = (formData.get('content') as string) || '';
  const id = createNote(db, title, content);
  revalidatePath('/notes');
  redirect(`/notes/${id}`);
}

export async function updateNoteAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  const title = formData.get('title') as string;
  const content = (formData.get('content') as string) || '';
  updateNote(db, id, title, content);
  revalidatePath('/notes');
  revalidatePath(`/notes/${id}`);
}

export async function deleteNoteAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  deleteNote(db, id);
  revalidatePath('/notes');
  redirect('/notes');
}

export async function togglePinNoteAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  togglePinNote(db, id);
  revalidatePath('/notes');
}
