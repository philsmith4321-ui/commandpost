import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { createNotification } from '@/lib/notifications';

interface RecurringInvoiceRow {
  id: number;
  client_id: number;
  invoice_number: string;
  total_amount: number;
  client_name: string;
}

interface InvoiceItemRow {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export async function GET() {
  const db = getDb();
  const today = new Date();
  const dayOfMonth = today.getDate();

  const recurring = db.prepare(`
    SELECT i.*, c.name as client_name
    FROM invoices i JOIN clients c ON i.client_id = c.id
    WHERE i.is_recurring = 1 AND i.recurrence_day = ? AND i.status != 'void'
  `).all(dayOfMonth) as RecurringInvoiceRow[];

  let generated = 0;

  for (const inv of recurring) {
    const thisMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const exists = db.prepare(
      "SELECT id FROM invoices WHERE invoice_number LIKE ?"
    ).get(`${inv.invoice_number}-${thisMonth}%`);

    if (exists) continue;

    const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(inv.id) as InvoiceItemRow[];

    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + 30);
    const dueDateStr = dueDate.toISOString().split('T')[0];
    const invoiceNumber = `${inv.invoice_number}-${thisMonth}`;

    const result = db.prepare(
      "INSERT INTO invoices (client_id, invoice_number, issue_date, due_date, total_amount, status, notes) VALUES (?, ?, date('now'), ?, ?, 'draft', ?)"
    ).run(inv.client_id, invoiceNumber, dueDateStr, inv.total_amount, `Auto-generated from recurring invoice ${inv.invoice_number}`);
    const newId = Number(result.lastInsertRowid);

    for (const item of items) {
      db.prepare(
        'INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (?, ?, ?, ?, ?)'
      ).run(newId, item.description, item.quantity, item.unit_price, item.amount);
    }

    await createNotification(db, {
      type: 'invoice_paid',
      title: `Recurring invoice generated: ${invoiceNumber}`,
      message: `$${inv.total_amount} for ${inv.client_name}`,
      link: `/finances/invoices/${newId}`,
    });

    generated++;
  }

  return NextResponse.json({ generated, checked: recurring.length, day: dayOfMonth });
}
