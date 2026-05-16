import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';

let db: Database.Database;
let initDb: typeof import('@/lib/db').initDb;
let getRecurringInvoices: typeof import('@/lib/queries/invoice-queries').getRecurringInvoices;
let getMrr: typeof import('@/lib/queries/invoice-queries').getMrr;
let getClientRecurringInvoices: typeof import('@/lib/queries/invoice-queries').getClientRecurringInvoices;

beforeEach(async () => {
  const dbModule = await import('../../src/lib/db');
  initDb = dbModule.initDb;
  db = initDb(`test-recurring-inv-${Date.now()}-${Math.random()}.db`);
  const mod = await import('../../src/lib/queries/invoice-queries');
  getRecurringInvoices = mod.getRecurringInvoices;
  getMrr = mod.getMrr;
  getClientRecurringInvoices = mod.getClientRecurringInvoices;
});

describe('recurring invoice queries', () => {
  it('getRecurringInvoices returns only recurring invoices with client name', () => {
    const clientId = db.prepare("INSERT INTO clients (name, status) VALUES ('Acme', 'active')").run().lastInsertRowid;
    db.prepare(
      "INSERT INTO invoices (client_id, invoice_number, status, due_date, is_recurring, recurrence_day, total_amount) VALUES (?, 'INV-0001', 'sent', '2026-06-15', 1, 15, 2000)"
    ).run(clientId);
    db.prepare(
      "INSERT INTO invoices (client_id, invoice_number, status, due_date, is_recurring, recurrence_day, total_amount) VALUES (?, 'INV-0002', 'draft', '2026-06-01', 0, NULL, 500)"
    ).run(clientId);

    const recurring = getRecurringInvoices(db);
    expect(recurring).toHaveLength(1);
    expect(recurring[0].invoice_number).toBe('INV-0001');
    expect(recurring[0].client_name).toBe('Acme');
    expect(recurring[0].recurrence_day).toBe(15);
  });

  it('getMrr returns sum of all recurring invoice amounts', () => {
    const clientId = db.prepare("INSERT INTO clients (name, status) VALUES ('Acme', 'active')").run().lastInsertRowid;
    db.prepare(
      "INSERT INTO invoices (client_id, invoice_number, status, due_date, is_recurring, recurrence_day, total_amount) VALUES (?, 'INV-0001', 'sent', '2026-06-15', 1, 15, 2000)"
    ).run(clientId);
    db.prepare(
      "INSERT INTO invoices (client_id, invoice_number, status, due_date, is_recurring, recurrence_day, total_amount) VALUES (?, 'INV-0002', 'paid', '2026-05-15', 1, 15, 1500)"
    ).run(clientId);
    db.prepare(
      "INSERT INTO invoices (client_id, invoice_number, status, due_date, is_recurring, recurrence_day, total_amount) VALUES (?, 'INV-0003', 'draft', '2026-06-01', 0, NULL, 500)"
    ).run(clientId);

    expect(getMrr(db)).toBe(3500);
  });

  it('getMrr returns 0 when no recurring invoices exist', () => {
    expect(getMrr(db)).toBe(0);
  });

  it('getClientRecurringInvoices returns recurring invoices for a specific client', () => {
    const client1 = db.prepare("INSERT INTO clients (name, status) VALUES ('Client A', 'active')").run().lastInsertRowid;
    const client2 = db.prepare("INSERT INTO clients (name, status) VALUES ('Client B', 'active')").run().lastInsertRowid;
    db.prepare(
      "INSERT INTO invoices (client_id, invoice_number, status, due_date, is_recurring, recurrence_day, total_amount) VALUES (?, 'INV-0001', 'sent', '2026-06-15', 1, 15, 2000)"
    ).run(client1);
    db.prepare(
      "INSERT INTO invoices (client_id, invoice_number, status, due_date, is_recurring, recurrence_day, total_amount) VALUES (?, 'INV-0002', 'sent', '2026-06-01', 1, 1, 1000)"
    ).run(client2);

    const result = getClientRecurringInvoices(db, Number(client1));
    expect(result).toHaveLength(1);
    expect(result[0].invoice_number).toBe('INV-0001');
  });
});
