import type Database from 'better-sqlite3';

export interface PaymentRow {
  id: number;
  invoice_id: number;
  amount: number;
  payment_method: string;
  notes: string | null;
  paid_at: string;
}

export function addPayment(db: Database.Database, input: {
  invoice_id: number;
  amount: number;
  payment_method?: string;
  notes?: string | null;
}): number {
  const result = db.prepare(
    'INSERT INTO invoice_payments (invoice_id, amount, payment_method, notes) VALUES (?, ?, ?, ?)'
  ).run(input.invoice_id, input.amount, input.payment_method || 'other', input.notes ?? null);
  return Number(result.lastInsertRowid);
}

export function getPaymentsForInvoice(db: Database.Database, invoiceId: number): PaymentRow[] {
  return db.prepare('SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY paid_at DESC').all(invoiceId) as PaymentRow[];
}

export function getTotalPaid(db: Database.Database, invoiceId: number): number {
  const row = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM invoice_payments WHERE invoice_id = ?').get(invoiceId) as { total: number };
  return row.total;
}

export function deletePayment(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM invoice_payments WHERE id = ?').run(id);
}
