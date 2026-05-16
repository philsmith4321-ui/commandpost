'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import {
  createInvoice,
  updateInvoice,
  markInvoiceSent,
  markInvoicePaid,
  deleteInvoice,
  getInvoiceById,
  setStripePaymentLink,
  setStripePaymentId,
} from '@/lib/queries/invoice-queries';
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
  revalidatePath('/finances');
  revalidatePath(`/finances/invoices/${id}`);
  redirect(`/finances/invoices/${id}`);
}

export async function markInvoicePaidAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  markInvoicePaid(db, id);
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
