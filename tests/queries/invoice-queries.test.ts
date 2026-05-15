import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initDb } from '@/lib/db';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-invoices.db');

describe('invoice queries', () => {
  let db: Database.Database;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    db = initDb(TEST_DB_PATH);
    db.prepare("INSERT INTO clients (name, status) VALUES (?, ?)").run('Test Client', 'active');
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('creates an invoice with auto-generated number and items', async () => {
    const { createInvoice, getInvoiceById } = await import('@/lib/queries/invoice-queries');
    const id = createInvoice(db, {
      client_id: 1,
      due_date: '2026-06-01',
      items: [
        { description: 'Web Design', quantity: 1, unit_price: 3000 },
        { description: 'Hosting Setup', quantity: 2, unit_price: 500 },
      ],
    });
    expect(id).toBeGreaterThan(0);
    const invoice = getInvoiceById(db, id);
    expect(invoice!.invoice_number).toBe('INV-0001');
    expect(invoice!.status).toBe('draft');
    expect(invoice!.total_amount).toBe(4000);
    expect(invoice!.items).toHaveLength(2);
    expect(invoice!.items[0].amount).toBe(3000);
    expect(invoice!.items[1].amount).toBe(1000);
  });

  it('auto-increments invoice numbers', async () => {
    const { createInvoice, getInvoiceById } = await import('@/lib/queries/invoice-queries');
    const id1 = createInvoice(db, { client_id: 1, due_date: '2026-06-01', items: [{ description: 'A', quantity: 1, unit_price: 100 }] });
    const id2 = createInvoice(db, { client_id: 1, due_date: '2026-07-01', items: [{ description: 'B', quantity: 1, unit_price: 200 }] });
    expect(getInvoiceById(db, id1)!.invoice_number).toBe('INV-0001');
    expect(getInvoiceById(db, id2)!.invoice_number).toBe('INV-0002');
  });

  it('marks invoice as sent', async () => {
    const { createInvoice, markInvoiceSent, getInvoiceById } = await import('@/lib/queries/invoice-queries');
    const id = createInvoice(db, { client_id: 1, due_date: '2026-06-01', items: [{ description: 'A', quantity: 1, unit_price: 100 }] });
    markInvoiceSent(db, id);
    const invoice = getInvoiceById(db, id);
    expect(invoice!.status).toBe('sent');
    expect(invoice!.sent_at).toBeTruthy();
  });

  it('marks invoice as paid', async () => {
    const { createInvoice, markInvoiceSent, markInvoicePaid, getInvoiceById } = await import('@/lib/queries/invoice-queries');
    const id = createInvoice(db, { client_id: 1, due_date: '2026-06-01', items: [{ description: 'A', quantity: 1, unit_price: 100 }] });
    markInvoiceSent(db, id);
    markInvoicePaid(db, id);
    const invoice = getInvoiceById(db, id);
    expect(invoice!.status).toBe('paid');
    expect(invoice!.paid_at).toBeTruthy();
  });

  it('lists invoices with client name and overdue detection', async () => {
    const { createInvoice, markInvoiceSent, listInvoices } = await import('@/lib/queries/invoice-queries');
    const id1 = createInvoice(db, { client_id: 1, due_date: '2025-01-01', items: [{ description: 'A', quantity: 1, unit_price: 100 }] });
    markInvoiceSent(db, id1);
    createInvoice(db, { client_id: 1, due_date: '2099-12-31', items: [{ description: 'B', quantity: 1, unit_price: 200 }] });
    const all = listInvoices(db);
    expect(all).toHaveLength(2);
    const overdue = listInvoices(db, 'overdue');
    expect(overdue).toHaveLength(1);
    expect(overdue[0].client_name).toBe('Test Client');
  });

  it('updates invoice and recalculates total', async () => {
    const { createInvoice, updateInvoice, getInvoiceById } = await import('@/lib/queries/invoice-queries');
    const id = createInvoice(db, { client_id: 1, due_date: '2026-06-01', items: [{ description: 'A', quantity: 1, unit_price: 100 }] });
    updateInvoice(db, id, {
      due_date: '2026-07-01',
      notes: 'Updated',
      items: [
        { description: 'New item', quantity: 3, unit_price: 500 },
      ],
    });
    const invoice = getInvoiceById(db, id);
    expect(invoice!.due_date).toBe('2026-07-01');
    expect(invoice!.notes).toBe('Updated');
    expect(invoice!.total_amount).toBe(1500);
    expect(invoice!.items).toHaveLength(1);
  });

  it('gets invoice summary stats', async () => {
    const { createInvoice, markInvoiceSent, markInvoicePaid, getInvoiceSummary } = await import('@/lib/queries/invoice-queries');
    const id1 = createInvoice(db, { client_id: 1, due_date: '2025-01-01', items: [{ description: 'A', quantity: 1, unit_price: 1000 }] });
    markInvoiceSent(db, id1);
    const id2 = createInvoice(db, { client_id: 1, due_date: '2099-12-31', items: [{ description: 'B', quantity: 1, unit_price: 2000 }] });
    markInvoiceSent(db, id2);
    const id3 = createInvoice(db, { client_id: 1, due_date: '2026-05-01', items: [{ description: 'C', quantity: 1, unit_price: 500 }] });
    markInvoiceSent(db, id3);
    markInvoicePaid(db, id3);
    const summary = getInvoiceSummary(db);
    expect(summary.totalOutstanding).toBe(3000);
    expect(summary.totalOverdue).toBe(1000);
    expect(summary.overdueCount).toBe(1);
  });

  it('deletes an invoice', async () => {
    const { createInvoice, deleteInvoice, getInvoiceById } = await import('@/lib/queries/invoice-queries');
    const id = createInvoice(db, { client_id: 1, due_date: '2026-06-01', items: [{ description: 'A', quantity: 1, unit_price: 100 }] });
    deleteInvoice(db, id);
    expect(getInvoiceById(db, id)).toBeUndefined();
  });
});
