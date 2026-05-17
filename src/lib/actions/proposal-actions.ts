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

export async function sendProposalEmailAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  const recipientEmail = formData.get('email') as string;
  const message = formData.get('message') as string;

  const { getProposalById, getProposalItems, markProposalSent } = await import('@/lib/queries/proposal-queries');
  const proposal = getProposalById(db, id);
  if (!proposal || !recipientEmail) return;

  // Auto mark as sent if still draft
  if (proposal.status === 'draft') {
    markProposalSent(db, id);
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://commandpost.rekindleleads.com';
  const token = proposal.token || db.prepare('SELECT token FROM proposals WHERE id = ?').get(id) as any;
  const viewUrl = token?.token ? `${baseUrl}/proposals/view/${token.token}` : `${baseUrl}/api/proposals/${id}/print`;

  const items = getProposalItems(db, id);
  const itemsHtml = items.map(item =>
    `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;">${item.description}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right;">$${item.amount.toLocaleString()}</td></tr>`
  ).join('');

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a2e;">Proposal: ${proposal.title}</h2>
      <p>${message || `Please review the attached proposal for ${proposal.title}. The total is $${proposal.total_amount.toLocaleString()}.`}</p>
      <div style="margin: 24px 0; padding: 16px; background: #f8f9fa; border-radius: 8px;">
        <p style="margin: 0;"><strong>Proposal:</strong> ${proposal.title}</p>
        <p style="margin: 4px 0;"><strong>Total:</strong> $${proposal.total_amount.toLocaleString()}</p>
        ${proposal.valid_until ? `<p style="margin: 4px 0;"><strong>Valid Until:</strong> ${proposal.valid_until}</p>` : ''}
        ${items.length > 0 ? `<table style="width:100%;border-collapse:collapse;margin-top:12px;"><thead><tr style="background:#e5e7eb;"><th style="padding:6px 12px;text-align:left;">Item</th><th style="padding:6px 12px;text-align:right;">Amount</th></tr></thead><tbody>${itemsHtml}</tbody></table>` : ''}
      </div>
      <p><a href="${viewUrl}" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">View Proposal</a></p>
    </div>
  `;

  const { sendEmail } = await import('@/lib/email');
  const { logEmail } = await import('@/lib/queries/email-log-queries');

  const sent = await sendEmail({
    to: recipientEmail,
    subject: `Proposal: ${proposal.title} — $${proposal.total_amount.toLocaleString()}`,
    html,
  });

  if (sent) {
    logEmail(db, {
      client_id: proposal.client_id,
      recipient_email: recipientEmail,
      subject: `Proposal: ${proposal.title}`,
      email_type: 'proposal',
      reference_id: id,
    });
  }

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
