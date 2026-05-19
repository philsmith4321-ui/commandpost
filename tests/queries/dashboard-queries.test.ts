import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initDb } from '@/lib/db';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-dashboard.db');

describe('dashboard queries', () => {
  let db: Database.Database;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    db = initDb(TEST_DB_PATH);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('returns correct summary stats', async () => {
    const { getDashboardSummary } = await import('@/lib/queries/dashboard-queries');
    db.prepare("INSERT INTO clients (name, status, monthly_value) VALUES (?, ?, ?)").run('Client A', 'active', 3000);
    db.prepare("INSERT INTO clients (name, status, monthly_value) VALUES (?, ?, ?)").run('Client B', 'active', 2000);
    db.prepare("INSERT INTO clients (name, status) VALUES (?, ?)").run('Client C', 'completed');
    const summary = getDashboardSummary(db);
    expect(summary.activeClients).toBe(2);
    expect(summary.monthlyRevenue).toBe(5000);
  });

  it('returns overdue deliverables as action items', async () => {
    const { getActionItems } = await import('@/lib/queries/dashboard-queries');
    const clientId = Number(db.prepare("INSERT INTO clients (name, status) VALUES (?, ?)").run('Test', 'active').lastInsertRowid);
    const projectId = Number(db.prepare("INSERT INTO projects (client_id, name, status) VALUES (?, ?, ?)").run(clientId, 'Proj', 'active').lastInsertRowid);
    db.prepare("INSERT INTO deliverables (project_id, title, status, due_date) VALUES (?, ?, ?, ?)").run(projectId, 'Overdue item', 'in_progress', '2025-01-01');
    db.prepare("INSERT INTO deliverables (project_id, title, status, due_date) VALUES (?, ?, ?, ?)").run(projectId, 'Future item', 'not_started', '2099-12-31');
    const items = getActionItems(db);
    const overdueItems = items.filter(i => i.type === 'overdue_deliverable');
    expect(overdueItems).toHaveLength(1);
    expect(overdueItems[0].title).toContain('Overdue item');
  });

  it('includes missed follow-ups in action items', async () => {
    const { getActionItems } = await import('@/lib/queries/dashboard-queries');

    db.prepare("INSERT INTO leads (business_name, source, stage, follow_up_date) VALUES (?, ?, ?, ?)").run('Stale Lead', 'referral', 'contacted', '2025-01-01');

    const items = getActionItems(db);
    const followUps = items.filter(i => i.type === 'missed_follow_up');
    expect(followUps).toHaveLength(1);
    expect(followUps[0].title).toContain('Stale Lead');
  });

  it('includes overdue invoices in action items', async () => {
    const { getActionItems } = await import('@/lib/queries/dashboard-queries');
    const clientId = Number(db.prepare("INSERT INTO clients (name, status) VALUES (?, ?)").run('Invoice Client', 'active').lastInsertRowid);
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, total_amount) VALUES (?, ?, ?, ?, ?)").run(clientId, 'INV-0001', 'sent', '2025-01-01', 5000);
    const items = getActionItems(db);
    const invoiceItems = items.filter(i => i.type === 'overdue_invoice');
    expect(invoiceItems).toHaveLength(1);
    expect(invoiceItems[0].title).toContain('INV-0001');
    expect(invoiceItems[0].urgency).toBe('red');
  });

});
