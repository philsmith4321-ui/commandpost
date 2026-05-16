'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import {
  createProposal,
  markProposalSent,
  updateProposalStatus,
  addProposalItem,
  deleteProposalItems,
} from '@/lib/queries/proposal-queries';

export async function createProposalAction(formData: FormData) {
  const db = getDb();

  const title = formData.get('title') as string;
  const leadId = formData.get('lead_id') ? Number(formData.get('lead_id')) : null;
  const clientId = formData.get('client_id') ? Number(formData.get('client_id')) : null;
  const scope = (formData.get('scope') as string) || null;
  const timeline = (formData.get('timeline') as string) || null;
  const validUntil = (formData.get('valid_until') as string) || null;

  const proposalId = createProposal(db, { title, lead_id: leadId, client_id: clientId, scope, timeline, valid_until: validUntil });

  // Parse line items from form
  const descriptions = formData.getAll('item_description') as string[];
  const quantities = formData.getAll('item_quantity') as string[];
  const unitPrices = formData.getAll('item_unit_price') as string[];

  for (let i = 0; i < descriptions.length; i++) {
    if (!descriptions[i]) continue;
    const quantity = Number(quantities[i]) || 1;
    const unitPrice = Number(unitPrices[i]) || 0;
    const amount = Math.round(quantity * unitPrice * 100) / 100;
    addProposalItem(db, proposalId, { description: descriptions[i], quantity, unit_price: unitPrice, amount });
  }

  revalidatePath('/proposals');
  redirect(`/proposals/${proposalId}`);
}

export async function markProposalSentAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  markProposalSent(db, id);
  revalidatePath('/proposals');
  revalidatePath(`/proposals/${id}`);
  redirect(`/proposals/${id}`);
}

export async function markProposalRejectedAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  updateProposalStatus(db, id, 'rejected');
  revalidatePath('/proposals');
  revalidatePath(`/proposals/${id}`);
  redirect(`/proposals/${id}`);
}
