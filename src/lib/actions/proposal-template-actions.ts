'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { createProposalTemplate, deleteProposalTemplate } from '@/lib/queries/proposal-template-queries';

export async function createProposalTemplateAction(formData: FormData) {
  const db = getDb();
  const descriptions = formData.getAll('item_description') as string[];
  const quantities = formData.getAll('item_quantity') as string[];
  const unitPrices = formData.getAll('item_unit_price') as string[];

  const items = descriptions.map((desc, i) => ({
    description: desc,
    quantity: Number(quantities[i]) || 1,
    unit_price: Number(unitPrices[i]) || 0,
  })).filter(item => item.description && item.unit_price > 0);

  createProposalTemplate(db, {
    name: formData.get('name') as string,
    scope: (formData.get('scope') as string) || undefined,
    timeline: (formData.get('timeline') as string) || undefined,
    valid_days: Number(formData.get('valid_days')) || 30,
    items,
  });

  revalidatePath('/proposals/templates');
}

export async function deleteProposalTemplateAction(formData: FormData) {
  const db = getDb();
  deleteProposalTemplate(db, Number(formData.get('id')));
  revalidatePath('/proposals/templates');
}

export async function useProposalTemplateAction(formData: FormData) {
  const db = getDb();
  const templateId = Number(formData.get('template_id'));
  const clientId = formData.get('client_id') ? Number(formData.get('client_id')) : null;
  const leadId = formData.get('lead_id') ? Number(formData.get('lead_id')) : null;

  const { getProposalTemplate } = await import('@/lib/queries/proposal-template-queries');
  const template = getProposalTemplate(db, templateId);
  if (!template) return;

  const validUntil = new Date(Date.now() + template.valid_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

  const result = db.prepare(
    "INSERT INTO proposals (title, scope, timeline, valid_until, token, client_id, lead_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(template.name, template.scope, template.timeline, validUntil, token, clientId, leadId);
  const proposalId = Number(result.lastInsertRowid);

  const stmt = db.prepare("INSERT INTO proposal_items (proposal_id, description, quantity, unit_price, amount) VALUES (?, ?, ?, ?, ?)");
  for (const item of template.items) {
    stmt.run(proposalId, item.description, item.quantity, item.unit_price, item.quantity * item.unit_price);
  }

  revalidatePath('/proposals');
  redirect(`/proposals/${proposalId}`);
}
