import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initDb } from '@/lib/db';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-report-queries.db');

describe('report queries', () => {
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

  it('getPnlData returns revenue, expenses by category, and profit for a date range', async () => {
    const { getPnlData } = await import('@/lib/queries/report-queries');
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, paid_at, total_amount) VALUES (?, ?, ?, ?, ?, ?)").run(1, 'INV-0001', 'paid', '2026-05-01', '2026-05-02', 5000);
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, paid_at, total_amount) VALUES (?, ?, ?, ?, ?, ?)").run(1, 'INV-0002', 'paid', '2026-04-01', '2026-04-05', 2000);
    db.prepare("INSERT INTO expenses (client_id, category, description, amount, expense_date) VALUES (?, ?, ?, ?, ?)").run(1, 'servers', 'Hosting', 500, '2026-05-10');
    db.prepare("INSERT INTO expenses (client_id, category, description, amount, expense_date) VALUES (?, ?, ?, ?, ?)").run(null, 'software', 'License', 300, '2026-05-15');
    db.prepare("INSERT INTO expenses (client_id, category, description, amount, expense_date) VALUES (?, ?, ?, ?, ?)").run(null, 'other', 'Outside range', 100, '2026-04-01');

    const data = getPnlData(db, '2026-05-01', '2026-05-31');
    expect(data.revenue).toBe(5000);
    expect(data.totalExpenses).toBe(800);
    expect(data.profit).toBe(4200);
    expect(data.expensesByCategory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'servers', amount: 500 }),
        expect.objectContaining({ category: 'software', amount: 300 }),
      ])
    );
  });

  it('getClientRevenueData returns per-client revenue sorted descending', async () => {
    const { getClientRevenueData } = await import('@/lib/queries/report-queries');
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, paid_at, total_amount) VALUES (?, ?, ?, ?, ?, ?)").run(1, 'INV-0001', 'paid', '2026-05-01', '2026-05-02', 5000);
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, paid_at, total_amount) VALUES (?, ?, ?, ?, ?, ?)").run(1, 'INV-0002', 'paid', '2026-05-10', '2026-05-11', 1000);
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, paid_at, total_amount) VALUES (?, ?, ?, ?, ?, ?)").run(2, 'INV-0003', 'paid', '2026-05-05', '2026-05-06', 3000);

    const data = getClientRevenueData(db, '2026-05-01', '2026-05-31');
    expect(data).toHaveLength(2);
    expect(data[0].client_name).toBe('Client A');
    expect(data[0].revenue).toBe(6000);
    expect(data[0].invoice_count).toBe(2);
    expect(data[1].client_name).toBe('Client B');
    expect(data[1].revenue).toBe(3000);
    expect(data[1].invoice_count).toBe(1);
  });

  it('getExpenseExportData returns expenses in date range with client names', async () => {
    const { getExpenseExportData } = await import('@/lib/queries/report-queries');
    db.prepare("INSERT INTO expenses (client_id, category, description, amount, expense_date) VALUES (?, ?, ?, ?, ?)").run(1, 'servers', 'Hosting', 500, '2026-05-10');
    db.prepare("INSERT INTO expenses (client_id, category, description, amount, expense_date) VALUES (?, ?, ?, ?, ?)").run(null, 'software', 'License', 300, '2026-05-15');
    db.prepare("INSERT INTO expenses (client_id, category, description, amount, expense_date) VALUES (?, ?, ?, ?, ?)").run(null, 'other', 'Old', 100, '2026-03-01');

    const data = getExpenseExportData(db, '2026-05-01', '2026-05-31');
    expect(data).toHaveLength(2);
    expect(data[0].expense_date).toBe('2026-05-15');
    expect(data[0].client_name).toBeNull();
    expect(data[1].client_name).toBe('Client A');
  });

  it('getInvoiceExportData returns invoices in date range', async () => {
    const { getInvoiceExportData } = await import('@/lib/queries/report-queries');
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, total_amount, is_recurring, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(1, 'INV-0001', 'paid', '2026-05-01', 5000, 0, '2026-05-01');
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, total_amount, is_recurring, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(2, 'INV-0002', 'sent', '2026-05-15', 2000, 1, '2026-05-10');
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, total_amount, is_recurring, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(1, 'INV-0003', 'draft', '2026-03-01', 1000, 0, '2026-03-01');

    const data = getInvoiceExportData(db, '2026-05-01', '2026-05-31');
    expect(data).toHaveLength(2);
    expect(data[0].invoice_number).toBe('INV-0002');
    expect(data[1].invoice_number).toBe('INV-0001');
  });

  it('getPipelineReportData returns stage counts, conversion rate, and top leads', async () => {
    const { getPipelineReportData } = await import('@/lib/queries/report-queries');
    db.prepare("INSERT INTO leads (business_name, source, stage, estimated_value) VALUES (?, ?, ?, ?)").run('Lead A', 'referral', 'proposal', 10000);
    db.prepare("INSERT INTO leads (business_name, source, stage, estimated_value) VALUES (?, ?, ?, ?)").run('Lead B', 'website', 'new', 5000);
    db.prepare("INSERT INTO leads (business_name, source, stage, estimated_value, follow_up_date) VALUES (?, ?, ?, ?, ?)").run('Lead C', 'outbound', 'contacted', 8000, '2026-01-01');
    db.prepare("INSERT INTO leads (business_name, source, stage, estimated_value) VALUES (?, ?, ?, ?)").run('Won Lead', 'referral', 'won', 15000);
    db.prepare("INSERT INTO leads (business_name, source, stage, estimated_value, lost_reason) VALUES (?, ?, ?, ?, ?)").run('Lost Lead', 'other', 'lost', 3000, 'ghosted');

    const data = getPipelineReportData(db);
    expect(data.totalActiveLeads).toBe(3);
    expect(data.totalActiveValue).toBe(23000);
    expect(data.conversionRate).toBeCloseTo(50);
    expect(data.needsFollowUp).toBe(1);
    expect(data.stageBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stage: 'new', count: 1, value: 5000 }),
        expect.objectContaining({ stage: 'proposal', count: 1, value: 10000 }),
      ])
    );
    expect(data.topLeads).toHaveLength(3);
    expect(data.topLeads[0].business_name).toBe('Lead A');
  });

  it('getUptimeReportData returns per-endpoint uptime and incident counts', async () => {
    const { getUptimeReportData } = await import('@/lib/queries/report-queries');
    db.prepare("INSERT INTO endpoints (name, url, check_interval_seconds, slow_threshold_ms, is_active) VALUES (?, ?, ?, ?, ?)").run('API', 'https://api.example.com', 300, 5000, 1);
    db.prepare("INSERT INTO health_checks (endpoint_id, status_code, response_time_ms, is_healthy) VALUES (?, ?, ?, ?)").run(1, 200, 150, 1);
    db.prepare("INSERT INTO health_checks (endpoint_id, status_code, response_time_ms, is_healthy) VALUES (?, ?, ?, ?)").run(1, 200, 250, 1);
    db.prepare("INSERT INTO incidents (endpoint_id, started_at, resolved_at, duration_seconds) VALUES (?, ?, ?, ?)").run(1, '2026-05-01 10:00:00', '2026-05-01 10:05:00', 300);

    const data = getUptimeReportData(db);
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe('API');
    expect(data[0].uptime_percent).toBe(100);
    expect(data[0].avg_response_ms).toBe(200);
    expect(data[0].incident_count).toBe(1);
  });
});
