import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initDb } from '@/lib/db';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-finance.db');

describe('finance queries', () => {
  let db: Database.Database;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    db = initDb(TEST_DB_PATH);
    db.prepare("INSERT INTO clients (name, status) VALUES (?, ?)").run('Client A', 'active');
    db.prepare("INSERT INTO clients (name, status) VALUES (?, ?)").run('Client B', 'active');
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('gets monthly revenue for last 12 months', async () => {
    const { getMonthlyRevenue } = await import('@/lib/queries/finance-queries');
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, paid_at, total_amount) VALUES (?, ?, ?, ?, ?, ?)").run(1, 'INV-0001', 'paid', '2026-05-01', '2026-05-02', 3000);
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, paid_at, total_amount) VALUES (?, ?, ?, ?, ?, ?)").run(1, 'INV-0002', 'paid', '2026-05-15', '2026-05-16', 2000);
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, paid_at, total_amount) VALUES (?, ?, ?, ?, ?, ?)").run(2, 'INV-0003', 'paid', '2026-04-01', '2026-04-05', 1000);

    const revenue = getMonthlyRevenue(db);
    expect(revenue.length).toBe(12);
    const may = revenue.find(r => r.month === '2026-05');
    expect(may?.amount).toBe(5000);
    const apr = revenue.find(r => r.month === '2026-04');
    expect(apr?.amount).toBe(1000);
  });

  it('gets profitability per client', async () => {
    const { getProfitabilityByClient } = await import('@/lib/queries/finance-queries');
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, paid_at, total_amount) VALUES (?, ?, ?, ?, ?, ?)").run(1, 'INV-0001', 'paid', '2026-05-01', '2026-05-02', 3000);
    db.prepare("INSERT INTO expenses (client_id, category, description, amount, expense_date) VALUES (?, ?, ?, ?, ?)").run(1, 'servers', 'Hosting', 500, '2026-05-01');
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, paid_at, total_amount) VALUES (?, ?, ?, ?, ?, ?)").run(2, 'INV-0002', 'paid', '2026-05-01', '2026-05-03', 1000);
    db.prepare("INSERT INTO expenses (client_id, category, description, amount, expense_date) VALUES (?, ?, ?, ?, ?)").run(2, 'software', 'License', 200, '2026-05-01');

    const profit = getProfitabilityByClient(db);
    expect(profit).toHaveLength(2);
    expect(profit[0].client_name).toBe('Client A');
    expect(profit[0].revenue).toBe(3000);
    expect(profit[0].expenses).toBe(500);
    expect(profit[0].profit).toBe(2500);
  });

  it('gets YTD stats', async () => {
    const { getYtdStats } = await import('@/lib/queries/finance-queries');
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, paid_at, total_amount) VALUES (?, ?, ?, ?, ?, ?)").run(1, 'INV-0001', 'paid', '2026-05-01', '2026-05-02', 5000);
    db.prepare("INSERT INTO expenses (client_id, category, description, amount, expense_date) VALUES (?, ?, ?, ?, ?)").run(null, 'other', 'Office', 1000, '2026-03-01');
    const stats = getYtdStats(db);
    expect(stats.revenue).toBe(5000);
    expect(stats.expenses).toBe(1000);
    expect(stats.profit).toBe(4000);
  });

  it('gets revenue by client top 5', async () => {
    const { getRevenueByClient } = await import('@/lib/queries/finance-queries');
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, paid_at, total_amount) VALUES (?, ?, ?, ?, ?, ?)").run(1, 'INV-0001', 'paid', '2026-05-01', '2026-05-02', 5000);
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, paid_at, total_amount) VALUES (?, ?, ?, ?, ?, ?)").run(2, 'INV-0002', 'paid', '2026-05-01', '2026-05-03', 2000);
    const top = getRevenueByClient(db);
    expect(top).toHaveLength(2);
    expect(top[0].client_name).toBe('Client A');
    expect(top[0].total).toBe(5000);
  });
});
