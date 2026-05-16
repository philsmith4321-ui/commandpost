'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { createTimeEntry, deleteTimeEntry, getUninvoicedByClient, markEntriesInvoiced } from '@/lib/queries/time-queries';
import { createNotification } from '@/lib/notifications';

export async function logTimeAction(formData: FormData) {
  const db = getDb();
  const projectId = Number(formData.get('project_id'));
  const clientId = Number(formData.get('client_id'));
  const deliverableIdStr = formData.get('deliverable_id') as string;
  const deliverableId = deliverableIdStr ? Number(deliverableIdStr) : null;
  const hours = Number(formData.get('hours') || 0);
  const minutes = Number(formData.get('minutes') || 0);
  const durationMinutes = hours * 60 + minutes;
  const entryDate = formData.get('entry_date') as string;
  const description = (formData.get('description') as string) || null;
  const hourlyRate = Number(formData.get('hourly_rate'));

  if (durationMinutes <= 0) return;

  createTimeEntry(db, {
    project_id: projectId,
    deliverable_id: deliverableId,
    duration_minutes: durationMinutes,
    entry_date: entryDate,
    hourly_rate: hourlyRate,
    description,
  });

  revalidatePath(`/clients/${clientId}/projects/${projectId}`);
  revalidatePath('/finances');
}

export async function deleteTimeEntryAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  const clientId = Number(formData.get('client_id'));
  const projectId = Number(formData.get('project_id'));

  deleteTimeEntry(db, id);

  revalidatePath(`/clients/${clientId}/projects/${projectId}`);
  revalidatePath('/finances');
}

export async function generateInvoiceFromTimeAction(formData: FormData) {
  const db = getDb();
  const clientId = Number(formData.get('client_id'));

  const entries = getUninvoicedByClient(db, clientId);
  if (entries.length === 0) return;

  // Generate invoice number
  const lastInvoice = db.prepare("SELECT invoice_number FROM invoices ORDER BY id DESC LIMIT 1").get() as any;
  let nextNum = 1001;
  if (lastInvoice) {
    const match = lastInvoice.invoice_number.match(/(\d+)/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }
  const invoiceNumber = `INV-${nextNum}`;

  // Build line items
  const lineItems: { description: string; quantity: number; unit_price: number; amount: number }[] = [];
  for (const entry of entries) {
    const deliverableTitle = entry.deliverable_id
      ? (db.prepare('SELECT title FROM deliverables WHERE id = ?').get(entry.deliverable_id) as any)?.title
      : null;
    const desc = deliverableTitle
      ? entry.description ? `${deliverableTitle} — ${entry.description}` : deliverableTitle
      : entry.description || 'Time entry';
    const quantity = Math.round((entry.duration_minutes / 60) * 100) / 100;
    const amount = Math.round(quantity * entry.hourly_rate * 100) / 100;
    lineItems.push({ description: desc, quantity, unit_price: entry.hourly_rate, amount });
  }

  const totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Create invoice
  const invoiceResult = db.prepare(`
    INSERT INTO invoices (client_id, invoice_number, status, due_date, total_amount)
    VALUES (?, ?, 'draft', ?, ?)
  `).run(clientId, invoiceNumber, dueDate, totalAmount);
  const invoiceId = Number(invoiceResult.lastInsertRowid);

  // Create line items
  const insertItem = db.prepare(`
    INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const item of lineItems) {
    insertItem.run(invoiceId, item.description, item.quantity, item.unit_price, item.amount);
  }

  // Mark entries as invoiced
  markEntriesInvoiced(db, entries.map(e => e.id), invoiceId);

  const clientName = (db.prepare('SELECT name FROM clients WHERE id = ?').get(clientId) as any)?.name;
  await createNotification(db, {
    type: 'time_invoiced',
    title: `Time invoiced: ${invoiceNumber}`,
    message: clientName ? `${clientName} — $${totalAmount}` : `$${totalAmount}`,
    link: `/finances/invoices/${invoiceId}`,
  });

  revalidatePath('/finances');
  redirect(`/finances/invoices/${invoiceId}`);
}

export async function updateProjectRateAction(formData: FormData) {
  const db = getDb();
  const projectId = Number(formData.get('project_id'));
  const clientId = Number(formData.get('client_id'));
  const hourlyRate = Number(formData.get('hourly_rate'));

  db.prepare("UPDATE projects SET hourly_rate = ?, updated_at = datetime('now') WHERE id = ?").run(hourlyRate, projectId);

  revalidatePath(`/clients/${clientId}/projects/${projectId}`);
}
