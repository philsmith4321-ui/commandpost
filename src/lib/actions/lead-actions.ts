'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import {
  createLead,
  updateLead,
  updateLeadStage,
  markLeadLost,
  markLeadWon,
  addLeadNote,
  deleteLead,
  getLeadById,
  listLeadNotes,
  getStageHistory,
} from '@/lib/queries/lead-queries';
import { isClaudeConfigured, askClaude } from '@/lib/claude';
import { createClient } from '@/lib/queries/client-queries';
import type { LeadStage, LeadSource, LostReason } from '@/lib/types';
import { createNotification } from '@/lib/notifications';

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
  logAudit(db, 'lead', id, `stage_changed`, stage);

  const lead = getLeadById(db, id);
  if (lead) {
    await createNotification(db, {
      type: 'lead_stage_changed',
      title: `${lead.business_name} → ${stage}`,
      message: null,
      link: `/pipeline/${id}`,
    });
  }

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
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId) as {
    business_name: string;
    contact_person: string | null;
    email: string | null;
    phone: string | null;
    source: string | null;
    estimated_value: number | null;
  } | undefined;

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

export type FollowUpResult = {
  email_subject: string;
  email_body: string;
  talking_points: string[];
} | { error: string };

const FOLLOW_UP_SYSTEM_PROMPT = `You are a business development assistant for a web development freelancer. Generate a follow-up for a potential client.

Provide your response in EXACTLY this format:
EMAIL_SUBJECT: [subject line]
EMAIL_BODY:
[email body, 3-5 paragraphs]
END_EMAIL
TALKING_POINTS:
- [point 1]
- [point 2]
- [point 3]
- [point 4]

Base your tone and content on the lead's stage, history, and how long since last contact. Be warm but professional. Reference specific details from the notes when relevant.`;

function parseFollowUpResponse(text: string): FollowUpResult {
  const subjectMatch = text.match(/EMAIL_SUBJECT:\s*(.+)/);
  const bodyMatch = text.match(/EMAIL_BODY:\s*\n([\s\S]*?)\nEND_EMAIL/);
  const pointsMatch = text.match(/TALKING_POINTS:\s*\n([\s\S]*?)$/);

  if (!subjectMatch || !bodyMatch) {
    return { error: 'Failed to parse AI response. Please try again.' };
  }

  const talking_points = pointsMatch
    ? pointsMatch[1].split('\n').map(l => l.replace(/^-\s*/, '').trim()).filter(Boolean)
    : [];

  return {
    email_subject: subjectMatch[1].trim(),
    email_body: bodyMatch[1].trim(),
    talking_points,
  };
}

export async function generateFollowUp(
  _prevState: FollowUpResult | null,
  formData: FormData
): Promise<FollowUpResult> {
  if (!isClaudeConfigured()) return { error: 'AI features not configured.' };

  const id = Number(formData.get('id'));
  const db = getDb();
  const lead = getLeadById(db, id);
  if (!lead) return { error: 'Lead not found.' };

  const notes = listLeadNotes(db, id);
  const history = getStageHistory(db, id);

  const lastNoteDate = notes.length > 0 ? notes[0].created_at : null;
  const daysSinceLastNote = lastNoteDate
    ? Math.floor((Date.now() - new Date(lastNoteDate + 'Z').getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const context = `Lead: ${lead.business_name}
Contact: ${lead.contact_person || 'Unknown'}
Email: ${lead.email || 'Unknown'}
Stage: ${lead.stage}
Source: ${lead.source}
Estimated Value: ${lead.estimated_value ? `$${lead.estimated_value.toLocaleString()}` : 'Unknown'}
Days since last contact: ${daysSinceLastNote !== null ? daysSinceLastNote : 'No notes yet'}

Stage History:
${history.map(h => `- ${h.stage} (${h.entered_at})`).join('\n')}

Notes (newest first):
${notes.length > 0 ? notes.slice(0, 10).map(n => `[${n.created_at}] ${n.content}`).join('\n') : 'No notes recorded.'}`;

  const response = await askClaude(FOLLOW_UP_SYSTEM_PROMPT, context);
  if (!response) return { error: 'Failed to generate follow-up. Please try again.' };

  return parseFollowUpResponse(response);
}
