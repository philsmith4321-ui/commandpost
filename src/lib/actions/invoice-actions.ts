'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import {
  createInvoice,
  updateInvoice,
  markInvoiceSent,
  markInvoicePaid,
  deleteInvoice,
  getInvoiceById,
  setStripePaymentLink,
  setStripePaymentId,
  markReminderSent,
} from '@/lib/queries/invoice-queries';
import { createNotification } from '@/lib/notifications';
import { isStripeConfigured, createStripePaymentLink, checkStripePayment } from '@/lib/stripe';

export async function createInvoiceAction(formData: FormData) {
  const db = getDb();
  const descriptions = formData.getAll('item_description') as string[];
  const quantities = formData.getAll('item_quantity') as string[];
  const unitPrices = formData.getAll('item_unit_price') as string[];

  const items = descriptions.map((desc, i) => ({
    description: desc,
    quantity: Number(quantities[i]) || 1,
    unit_price: Number(unitPrices[i]) || 0,
  })).filter(item => item.description && item.unit_price > 0);

  const id = createInvoice(db, {
    client_id: Number(formData.get('client_id')),
    due_date: formData.get('due_date') as string,
    notes: (formData.get('notes') as string) || null,
    is_recurring: formData.get('is_recurring') === 'on',
    recurrence_day: formData.get('recurrence_day') ? Number(formData.get('recurrence_day')) : null,
    items,
  });

  revalidatePath('/finances');
  redirect(`/finances/invoices/${id}`);
}

export async function updateInvoiceAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  const descriptions = formData.getAll('item_description') as string[];
  const quantities = formData.getAll('item_quantity') as string[];
  const unitPrices = formData.getAll('item_unit_price') as string[];

  const items = descriptions.map((desc, i) => ({
    description: desc,
    quantity: Number(quantities[i]) || 1,
    unit_price: Number(unitPrices[i]) || 0,
  })).filter(item => item.description && item.unit_price > 0);

  updateInvoice(db, id, {
    due_date: formData.get('due_date') as string,
    notes: (formData.get('notes') as string) || null,
    is_recurring: formData.get('is_recurring') === 'on',
    recurrence_day: formData.get('recurrence_day') ? Number(formData.get('recurrence_day')) : null,
    items,
  });

  revalidatePath('/finances');
  revalidatePath(`/finances/invoices/${id}`);
  redirect(`/finances/invoices/${id}`);
}

export async function markInvoiceSentAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  markInvoiceSent(db, id);
  logAudit(db, 'invoice', id, 'sent');
  revalidatePath('/finances');
  revalidatePath(`/finances/invoices/${id}`);
  redirect(`/finances/invoices/${id}`);
}

export async function markInvoicePaidAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  markInvoicePaid(db, id);
  logAudit(db, 'invoice', id, 'paid');

  const invoice = getInvoiceById(db, id);
  if (invoice) {
    await createNotification(db, {
      type: 'invoice_paid',
      title: `Invoice ${invoice.invoice_number} paid`,
      message: `$${invoice.total_amount}`,
      link: `/finances/invoices/${id}`,
    });
  }

  revalidatePath('/finances');
  revalidatePath(`/finances/invoices/${id}`);
  redirect(`/finances/invoices/${id}`);
}

export async function generateStripeLink(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  const invoice = getInvoiceById(db, id);
  if (!invoice || !isStripeConfigured()) return;

  const link = await createStripePaymentLink(invoice.total_amount, invoice.invoice_number);
  setStripePaymentLink(db, id, link);

  revalidatePath(`/finances/invoices/${id}`);
  redirect(`/finances/invoices/${id}`);
}

export async function syncStripePaymentAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  const invoice = getInvoiceById(db, id);
  if (!invoice?.stripe_payment_link || !isStripeConfigured()) return;

  const result = await checkStripePayment(invoice.stripe_payment_link);
  if (result.paid && result.paymentId) {
    setStripePaymentId(db, id, result.paymentId);
  }

  revalidatePath('/finances');
  revalidatePath(`/finances/invoices/${id}`);
  redirect(`/finances/invoices/${id}`);
}

export async function deleteInvoiceAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  deleteInvoice(db, id);
  revalidatePath('/finances');
  redirect('/finances');
}

export async function toggleRecurringAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  const invoice = getInvoiceById(db, id);
  if (!invoice) return;

  updateInvoice(db, id, { is_recurring: !invoice.is_recurring });

  revalidatePath('/finances');
  revalidatePath(`/finances/invoices/${id}`);
  revalidatePath(`/clients/${invoice.client_id}`);
}

export async function updateRecurrenceDayAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  const day = Number(formData.get('day'));
  if (day < 1 || day > 28) return;

  const invoice = getInvoiceById(db, id);
  if (!invoice) return;

  updateInvoice(db, id, { recurrence_day: day });

  revalidatePath('/finances');
  revalidatePath(`/finances/invoices/${id}`);
  revalidatePath(`/clients/${invoice.client_id}`);
}

export async function createRecurringInvoiceAction(formData: FormData) {
  const db = getDb();
  const clientId = Number(formData.get('client_id'));
  const recurrenceDay = Number(formData.get('recurrence_day'));
  const descriptions = formData.getAll('item_description') as string[];
  const quantities = formData.getAll('item_quantity') as string[];
  const unitPrices = formData.getAll('item_unit_price') as string[];

  const items = descriptions.map((desc, i) => ({
    description: desc,
    quantity: Number(quantities[i]) || 1,
    unit_price: Number(unitPrices[i]) || 0,
  })).filter(item => item.description && item.unit_price > 0);

  if (items.length === 0 || recurrenceDay < 1 || recurrenceDay > 28) return;

  // Set due date to next occurrence of recurrence_day
  const now = new Date();
  let dueMonth = now.getMonth();
  let dueYear = now.getFullYear();
  if (now.getDate() >= recurrenceDay) {
    dueMonth += 1;
    if (dueMonth > 11) { dueMonth = 0; dueYear += 1; }
  }
  const dueDate = `${dueYear}-${String(dueMonth + 1).padStart(2, '0')}-${String(recurrenceDay).padStart(2, '0')}`;

  const id = createInvoice(db, {
    client_id: clientId,
    due_date: dueDate,
    is_recurring: true,
    recurrence_day: recurrenceDay,
    items,
  });

  revalidatePath('/finances');
  revalidatePath(`/clients/${clientId}`);
  redirect(`/finances/invoices/${id}`);
}

export async function bulkInvoiceAction(formData: FormData) {
  const db = getDb();
  const ids = (formData.get('ids') as string || '').split(',').map(Number).filter(Boolean);
  const action = formData.get('action') as string;
  if (ids.length === 0 || !action) return;

  for (const id of ids) {
    if (action === 'mark_sent') {
      markInvoiceSent(db, id);
      logAudit(db, 'invoice', id, 'sent');
    } else if (action === 'mark_paid') {
      markInvoicePaid(db, id);
      logAudit(db, 'invoice', id, 'paid');
    } else if (action === 'delete') {
      deleteInvoice(db, id);
      logAudit(db, 'invoice', id, 'deleted');
    }
  }

  revalidatePath('/finances');
}

export async function sendInvoiceEmailAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  const recipientEmail = formData.get('email') as string;
  const message = formData.get('message') as string;
  const invoice = getInvoiceById(db, id);
  if (!invoice || !recipientEmail) return;

  const { sendEmail } = await import('@/lib/email');
  const { logEmail } = await import('@/lib/queries/email-log-queries');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://commandpost.rekindleleads.com';
  const pdfUrl = `${baseUrl}/api/invoices/${id}/pdf`;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a2e;">Invoice ${invoice.invoice_number}</h2>
      <p>${message || `Please find your invoice attached. The total amount is $${invoice.total_amount.toLocaleString()} and is due by ${invoice.due_date}.`}</p>
      <div style="margin: 24px 0; padding: 16px; background: #f8f9fa; border-radius: 8px;">
        <p style="margin: 0;"><strong>Invoice:</strong> ${invoice.invoice_number}</p>
        <p style="margin: 4px 0;"><strong>Amount:</strong> $${invoice.total_amount.toLocaleString()}</p>
        <p style="margin: 4px 0;"><strong>Due Date:</strong> ${invoice.due_date}</p>
        ${invoice.stripe_payment_link ? `<p style="margin: 4px 0;"><a href="${invoice.stripe_payment_link}" style="color: #2563eb;">Pay Online</a></p>` : ''}
      </div>
      <p><a href="${pdfUrl}" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">View Invoice</a></p>
    </div>
  `;

  const sent = await sendEmail({
    to: recipientEmail,
    subject: `Invoice ${invoice.invoice_number} — $${invoice.total_amount.toLocaleString()}`,
    html,
  });

  if (sent) {
    markInvoiceSent(db, id);
    logAudit(db, 'invoice', id, 'emailed');
    logEmail(db, {
      client_id: invoice.client_id,
      recipient_email: recipientEmail,
      subject: `Invoice ${invoice.invoice_number}`,
      email_type: 'invoice',
      reference_id: id,
    });
  }

  revalidatePath('/finances');
  revalidatePath(`/finances/invoices/${id}`);
  redirect(`/finances/invoices/${id}`);
}

export async function markReminderSentAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  const invoice = getInvoiceById(db, id);
  if (!invoice) return;

  markReminderSent(db, id);
  logAudit(db, 'invoice', id, 'reminder_sent');

  revalidatePath('/finances');
  revalidatePath('/finances/overdue');
  revalidatePath(`/finances/invoices/${id}`);
}
