import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

interface TimeEntryRow {
  id: number;
  client_id: number;
  duration_minutes: number;
  hourly_rate: number;
  description: string | null;
  entry_date: string;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const entryIdsJson = formData.get('entry_ids') as string;
  const entryIds: number[] = JSON.parse(entryIdsJson);

  if (!entryIds.length) {
    return NextResponse.json({ error: 'No entries selected' }, { status: 400 });
  }

  const db = getDb();

  // Get entries and determine client
  const placeholders = entryIds.map(() => '?').join(',');
  const entries = db.prepare(`
    SELECT te.*, p.client_id FROM time_entries te
    JOIN projects p ON te.project_id = p.id
    WHERE te.id IN (${placeholders}) AND te.is_invoiced = 0
  `).all(...entryIds) as TimeEntryRow[];

  if (entries.length === 0) {
    return NextResponse.json({ error: 'No valid uninvoiced entries' }, { status: 400 });
  }

  // All entries must belong to same client
  const clientIds = [...new Set(entries.map(e => e.client_id))];
  if (clientIds.length > 1) {
    return NextResponse.json({ error: 'Selected entries must belong to the same client' }, { status: 400 });
  }

  const clientId = clientIds[0];

  // Generate invoice number
  const lastInvoice = db.prepare("SELECT invoice_number FROM invoices ORDER BY id DESC LIMIT 1").get() as { invoice_number: string } | undefined;
  let nextNum = 1001;
  if (lastInvoice) {
    const match = lastInvoice.invoice_number.match(/(\d+)/);
    if (match) nextNum = Number(match[1]) + 1;
  }
  const invoiceNumber = `INV-${nextNum}`;

  // Calculate total
  let totalAmount = 0;
  const items: { description: string; quantity: number; unit_price: number; amount: number }[] = [];

  for (const entry of entries) {
    const hours = entry.duration_minutes / 60;
    const amount = hours * entry.hourly_rate;
    totalAmount += amount;
    items.push({
      description: entry.description || `Time entry ${entry.entry_date}`,
      quantity: hours,
      unit_price: entry.hourly_rate,
      amount,
    });
  }

  // Create invoice
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);

  const result = db.prepare(`
    INSERT INTO invoices (client_id, invoice_number, status, due_date, total_amount)
    VALUES (?, ?, 'draft', ?, ?)
  `).run(clientId, invoiceNumber, dueDate.toISOString().split('T')[0], totalAmount);

  const invoiceId = Number(result.lastInsertRowid);

  // Add line items
  const insertItem = db.prepare('INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (?, ?, ?, ?, ?)');
  for (const item of items) {
    insertItem.run(invoiceId, item.description, item.quantity, item.unit_price, item.amount);
  }

  // Mark entries as invoiced
  db.prepare(`UPDATE time_entries SET is_invoiced = 1, invoice_id = ? WHERE id IN (${placeholders})`).run(invoiceId, ...entryIds);

  return NextResponse.redirect(new URL(`/finances/invoices/${invoiceId}`, request.url));
}
