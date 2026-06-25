import type Database from 'better-sqlite3';
import type { Invoice, InvoiceItem, InvoiceStatus } from '@/lib/types';

interface CreateInvoiceInput {
  client_id: number;
  due_date: string;
  notes?: string | null;
  is_recurring?: boolean;
  recurrence_day?: number | null;
  items: { description: string; quantity: number; unit_price: number }[];
}

interface UpdateInvoiceInput {
  due_date?: string;
  notes?: string | null;
  is_recurring?: boolean;
  recurrence_day?: number | null;
  items?: { description: string; quantity: number; unit_price: number }[];
}

export interface InvoiceWithClient extends Invoice {
  client_name: string;
  client_email?: string | null;
  items: InvoiceItem[];
  is_overdue: boolean;
}

export interface InvoiceSummary {
  totalOutstanding: number;
  totalOverdue: number;
  overdueCount: number;
  paidThisMonth: number;
}

export interface RecurringInvoiceRow {
  id: number;
  invoice_number: string;
  client_id: number;
  client_name: string;
  total_amount: number;
  recurrence_day: number;
  status: InvoiceStatus;
  is_recurring: number;
}

function generateInvoiceNumber(db: Database.Database): string {
  const last = db.prepare("SELECT invoice_number FROM invoices ORDER BY id DESC LIMIT 1").get() as { invoice_number: string } | undefined;
  if (!last) return 'INV-0001';
  const num = parseInt(last.invoice_number.replace('INV-', ''), 10);
  return `INV-${String(num + 1).padStart(4, '0')}`;
}

function recalcTotal(db: Database.Database, invoiceId: number): void {
  const total = (db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM invoice_items WHERE invoice_id = ?").get(invoiceId) as { total: number }).total;
  db.prepare("UPDATE invoices SET total_amount = ?, updated_at = datetime('now') WHERE id = ?").run(total, invoiceId);
}

export function createInvoice(db: Database.Database, input: CreateInvoiceInput): number {
  const invoiceNumber = generateInvoiceNumber(db);

  const result = db.prepare(`
    INSERT INTO invoices (client_id, invoice_number, due_date, notes, is_recurring, recurrence_day)
    VALUES (@client_id, @invoice_number, @due_date, @notes, @is_recurring, @recurrence_day)
  `).run({
    client_id: input.client_id,
    invoice_number: invoiceNumber,
    due_date: input.due_date,
    notes: input.notes ?? null,
    is_recurring: input.is_recurring ? 1 : 0,
    recurrence_day: input.recurrence_day ?? null,
  });

  const invoiceId = Number(result.lastInsertRowid);

  const insertItem = db.prepare(
    'INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (?, ?, ?, ?, ?)'
  );
  for (const item of input.items) {
    insertItem.run(invoiceId, item.description, item.quantity, item.unit_price, item.quantity * item.unit_price);
  }

  recalcTotal(db, invoiceId);
  return invoiceId;
}

export function getInvoiceById(db: Database.Database, id: number): InvoiceWithClient | undefined {
  const invoice = db.prepare(`
    SELECT i.*, c.name as client_name, c.email as client_email
    FROM invoices i JOIN clients c ON i.client_id = c.id
    WHERE i.id = ?
  `).get(id) as (Invoice & { client_name: string; client_email: string | null }) | undefined;

  if (!invoice) return undefined;

  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id').all(id) as InvoiceItem[];
  const isOverdue = invoice.status === 'sent' && invoice.due_date < new Date().toISOString().split('T')[0];

  return { ...invoice, items, is_overdue: isOverdue };
}

export function listInvoices(db: Database.Database, statusFilter?: string): InvoiceWithClient[] {
  let sql = `
    SELECT i.*, c.name as client_name
    FROM invoices i JOIN clients c ON i.client_id = c.id
  `;
  const params: string[] = [];

  if (statusFilter === 'overdue') {
    sql += " WHERE i.status = 'sent' AND i.due_date < date('now')";
  } else if (statusFilter && statusFilter !== 'all') {
    sql += ' WHERE i.status = ?';
    params.push(statusFilter);
  }

  sql += ' ORDER BY i.created_at DESC';

  const invoices = db.prepare(sql).all(...params) as (Invoice & { client_name: string })[];

  return invoices.map((inv) => {
    const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id').all(inv.id) as InvoiceItem[];
    const isOverdue = inv.status === 'sent' && inv.due_date < new Date().toISOString().split('T')[0];
    return { ...inv, items, is_overdue: isOverdue };
  });
}

export function updateInvoice(db: Database.Database, id: number, input: UpdateInvoiceInput): void {
  if (input.due_date !== undefined || input.notes !== undefined || input.is_recurring !== undefined || input.recurrence_day !== undefined) {
    const fields: string[] = [];
    const params: Record<string, string | number | null> = { id };

    if (input.due_date !== undefined) { fields.push('due_date = @due_date'); params.due_date = input.due_date; }
    if (input.notes !== undefined) { fields.push('notes = @notes'); params.notes = input.notes; }
    if (input.is_recurring !== undefined) { fields.push('is_recurring = @is_recurring'); params.is_recurring = input.is_recurring ? 1 : 0; }
    if (input.recurrence_day !== undefined) { fields.push('recurrence_day = @recurrence_day'); params.recurrence_day = input.recurrence_day; }

    fields.push("updated_at = datetime('now')");
    db.prepare(`UPDATE invoices SET ${fields.join(', ')} WHERE id = @id`).run(params);
  }

  if (input.items) {
    db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(id);
    const insertItem = db.prepare(
      'INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (?, ?, ?, ?, ?)'
    );
    for (const item of input.items) {
      insertItem.run(id, item.description, item.quantity, item.unit_price, item.quantity * item.unit_price);
    }
    recalcTotal(db, id);
  }
}

export function markInvoiceSent(db: Database.Database, id: number): void {
  db.prepare("UPDATE invoices SET status = 'sent', sent_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(id);
}

export function markInvoicePaid(db: Database.Database, id: number): void {
  db.prepare("UPDATE invoices SET status = 'paid', paid_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(id);
}

export function deleteInvoice(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM invoices WHERE id = ?').run(id);
}

export function getInvoiceSummary(db: Database.Database): InvoiceSummary {
  const totalOutstanding = (db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'sent'").get() as { total: number }).total;
  const totalOverdue = (db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'sent' AND due_date < date('now')").get() as { total: number }).total;
  const overdueCount = (db.prepare("SELECT COUNT(*) as count FROM invoices WHERE status = 'sent' AND due_date < date('now')").get() as { count: number }).count;
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const paidThisMonth = (db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'paid' AND paid_at >= ?").get(monthStart) as { total: number }).total;
  return { totalOutstanding, totalOverdue, overdueCount, paidThisMonth };
}

export function getRecurringInvoicesDue(db: Database.Database): Invoice[] {
  return db.prepare("SELECT * FROM invoices WHERE is_recurring = 1 AND status IN ('sent','paid')").all() as Invoice[];
}

export function setStripePaymentLink(db: Database.Database, id: number, link: string): void {
  db.prepare("UPDATE invoices SET stripe_payment_link = ?, updated_at = datetime('now') WHERE id = ?").run(link, id);
}

export function setStripePaymentId(db: Database.Database, id: number, paymentId: string): void {
  db.prepare("UPDATE invoices SET stripe_payment_id = ?, status = 'paid', paid_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(paymentId, id);
}

export function getRecurringInvoices(db: Database.Database): RecurringInvoiceRow[] {
  return db.prepare(`
    SELECT i.id, i.invoice_number, i.client_id, c.name as client_name,
           i.total_amount, i.recurrence_day, i.status, i.is_recurring
    FROM invoices i JOIN clients c ON i.client_id = c.id
    WHERE i.is_recurring = 1
    ORDER BY c.name ASC
  `).all() as RecurringInvoiceRow[];
}

export function getMrr(db: Database.Database): number {
  return (db.prepare(
    "SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE is_recurring = 1"
  ).get() as { total: number }).total;
}

export interface OverdueInvoice {
  id: number;
  invoice_number: string;
  client_id: number;
  client_name: string;
  total_amount: number;
  due_date: string;
  days_overdue: number;
  last_reminder_sent: string | null;
  client_email: string | null;
}

export function getOverdueInvoices(db: Database.Database): OverdueInvoice[] {
  return db.prepare(`
    SELECT i.id, i.invoice_number, i.client_id, c.name as client_name,
           c.email as client_email,
           i.total_amount, i.due_date, i.last_reminder_sent,
           CAST(julianday('now') - julianday(i.due_date) AS INTEGER) as days_overdue
    FROM invoices i JOIN clients c ON i.client_id = c.id
    WHERE i.status = 'sent' AND i.due_date < date('now')
    ORDER BY i.due_date ASC
  `).all() as OverdueInvoice[];
}

export function markReminderSent(db: Database.Database, id: number): void {
  db.prepare("UPDATE invoices SET last_reminder_sent = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(id);
}

export function getClientRevenueHistory(db: Database.Database, clientId: number): { month: string; amount: number }[] {
  const rows = db.prepare(`
    SELECT strftime('%Y-%m', paid_at) as month, SUM(total_amount) as amount
    FROM invoices
    WHERE client_id = ? AND status = 'paid' AND paid_at IS NOT NULL
    GROUP BY strftime('%Y-%m', paid_at)
    ORDER BY month DESC
    LIMIT 12
  `).all(clientId) as { month: string; amount: number }[];
  return rows.reverse();
}

export function getClientRecurringInvoices(db: Database.Database, clientId: number): RecurringInvoiceRow[] {
  return db.prepare(`
    SELECT i.id, i.invoice_number, i.client_id, c.name as client_name,
           i.total_amount, i.recurrence_day, i.status, i.is_recurring
    FROM invoices i JOIN clients c ON i.client_id = c.id
    WHERE i.is_recurring = 1 AND i.client_id = ?
    ORDER BY i.recurrence_day ASC
  `).all(clientId) as RecurringInvoiceRow[];
}
