import { initDb } from '../src/lib/db';
import { createInvoice, getRecurringInvoicesDue } from '../src/lib/queries/invoice-queries';

const db = initDb();

function getNextDueDate(recurrenceDay: number): string {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();

  if (now.getDate() > recurrenceDay) {
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }

  const day = Math.min(recurrenceDay, new Date(year, month + 1, 0).getDate());
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function main() {
  const recurringInvoices = getRecurringInvoicesDue(db);
  const now = new Date();
  let created = 0;

  for (const invoice of recurringInvoices) {
    if (!invoice.recurrence_day) continue;

    const nextDue = getNextDueDate(invoice.recurrence_day);
    const nextDueDate = new Date(nextDue);
    const daysUntilDue = Math.floor((nextDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue > 7) continue;

    const existingMonth = nextDue.substring(0, 7);
    const existing = db.prepare(
      "SELECT id FROM invoices WHERE client_id = ? AND status = 'draft' AND strftime('%Y-%m', due_date) = ?"
    ).get(invoice.client_id, existingMonth);

    if (existing) continue;

    const items = db.prepare('SELECT description, quantity, unit_price FROM invoice_items WHERE invoice_id = ?').all(invoice.id) as any[];

    const newId = createInvoice(db, {
      client_id: invoice.client_id,
      due_date: nextDue,
      notes: invoice.notes,
      is_recurring: true,
      recurrence_day: invoice.recurrence_day,
      items: items.map((i: any) => ({
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
      })),
    });

    console.log(`Created recurring invoice (id: ${newId}) for client ${invoice.client_id}, due ${nextDue}`);
    created++;
  }

  console.log(`Done. ${created} recurring invoice(s) created.`);
}

main();
