'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import {
  createLead,
  updateLead,
  updateLeadStage,
  markLeadLost,
  markLeadWon,
  addLeadNote,
  deleteLead,
} from '@/lib/queries/lead-queries';
import { createClient } from '@/lib/queries/client-queries';
import type { LeadStage, LeadSource, LostReason } from '@/lib/types';

export async function createLeadAction(formData: FormData) {
  const db = getDb();
  const id = createLead(db, {
    business_name: formData.get('business_name') as string,
    contact_person: (formData.get('contact_person') as string) || null,
    email: (formData.get('email') as string) || null,
    phone: (formData.get('phone') as string) || null,
    website: (formData.get('website') as string) || null,
    source: (formData.get('source') as LeadSource) || 'other',
    estimated_value: formData.get('estimated_value')
      ? Number(formData.get('estimated_value'))
      : null,
    follow_up_date: (formData.get('follow_up_date') as string) || null,
  });

  revalidatePath('/pipeline');
  redirect(`/pipeline/${id}`);
}

export async function updateLeadAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));

  updateLead(db, id, {
    business_name: formData.get('business_name') as string,
    contact_person: (formData.get('contact_person') as string) || null,
    email: (formData.get('email') as string) || null,
    phone: (formData.get('phone') as string) || null,
    website: (formData.get('website') as string) || null,
    source: (formData.get('source') as LeadSource) || 'other',
    estimated_value: formData.get('estimated_value')
      ? Number(formData.get('estimated_value'))
      : null,
    follow_up_date: (formData.get('follow_up_date') as string) || null,
  });

  revalidatePath('/pipeline');
  revalidatePath(`/pipeline/${id}`);
  redirect(`/pipeline/${id}`);
}

export async function updateLeadStageAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  const stage = formData.get('stage') as LeadStage;

  updateLeadStage(db, id, stage);

  revalidatePath('/pipeline');
  revalidatePath(`/pipeline/${id}`);
}

export async function markLeadLostAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  const reason = formData.get('lost_reason') as LostReason;

  markLeadLost(db, id, reason);

  revalidatePath('/pipeline');
  revalidatePath(`/pipeline/${id}`);
  redirect('/pipeline');
}

export async function convertLeadToClientAction(formData: FormData) {
  const db = getDb();
  const leadId = Number(formData.get('lead_id'));
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId) as any;

  if (!lead) return;

  const clientId = createClient(db, {
    name: lead.business_name,
    contact_person: lead.contact_person,
    email: lead.email,
    phone: lead.phone,
    source: lead.source,
    status: 'active',
    monthly_value: lead.estimated_value,
  });

  markLeadWon(db, leadId, clientId);

  revalidatePath('/pipeline');
  revalidatePath('/clients');
  redirect(`/clients/${clientId}`);
}

export async function addLeadNoteAction(formData: FormData) {
  const db = getDb();
  const leadId = Number(formData.get('lead_id'));
  const content = formData.get('content') as string;

  addLeadNote(db, leadId, content);

  revalidatePath(`/pipeline/${leadId}`);
}

export async function deleteLeadAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  deleteLead(db, id);
  revalidatePath('/pipeline');
  redirect('/pipeline');
}
