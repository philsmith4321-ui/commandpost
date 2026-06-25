import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync, rmSync } from 'node:fs';

let db: Database.Database;
let dbPath: string;
let initDb: typeof import('@/lib/db').initDb;
let getClientHealth: typeof import('@/lib/queries/client-queries').getClientHealth;
let getClientHealthSummary: typeof import('@/lib/queries/client-queries').getClientHealthSummary;

beforeEach(async () => {
  const dbModule = await import('../../src/lib/db');
  initDb = dbModule.initDb;
  dbPath = join(tmpdir(), `cp-test-client-health-${Date.now()}-${Math.random()}.db`);
  db = initDb(dbPath);
  const mod = await import('../../src/lib/queries/client-queries');
  getClientHealth = mod.getClientHealth;
  getClientHealthSummary = mod.getClientHealthSummary;
});

afterEach(() => {
  try { db?.close(); } catch { /* already closed */ }
  for (const suffix of ['', '-wal', '-shm']) {
    const p = dbPath + suffix;
    if (existsSync(p)) try { rmSync(p); } catch { /* best effort */ }
  }
});

describe('getClientHealth', () => {
  it('returns healthy for client with fast payments, no outstanding, recent activity', () => {
    const clientId = db.prepare(
      "INSERT INTO clients (name, status) VALUES ('Good Client', 'active')"
    ).run().lastInsertRowid as number;

    const invId = db.prepare(
      "INSERT INTO invoices (client_id, invoice_number, status, due_date, sent_at, paid_at, total_amount) VALUES (?, 'INV-0001', 'paid', '2026-05-01', '2026-04-20', '2026-04-25', 1000)"
    ).run(clientId).lastInsertRowid;
    db.prepare("INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (?, 'Work', 1, 1000, 1000)").run(invId);

    db.prepare(
      "INSERT INTO activity_logs (client_id, content, created_at) VALUES (?, 'Meeting notes', datetime('now'))"
    ).run(clientId);

    const health = getClientHealth(db, Number(clientId));
    expect(health.score).toBeGreaterThanOrEqual(70);
    expect(health.status).toBe('healthy');
    expect(health.payment).toBe(40);
    expect(health.balance).toBe(30);
    expect(health.engagement).toBe(30);
  });

  it('returns needs_attention for client with slow payments, overdue invoices, no activity', () => {
    const clientId = db.prepare(
      "INSERT INTO clients (name, status) VALUES ('Bad Client', 'active')"
    ).run().lastInsertRowid as number;

    const invId = db.prepare(
      "INSERT INTO invoices (client_id, invoice_number, status, due_date, sent_at, paid_at, total_amount) VALUES (?, 'INV-0002', 'paid', '2026-03-01', '2026-02-01', '2026-03-18', 500)"
    ).run(clientId).lastInsertRowid;
    db.prepare("INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (?, 'Work', 1, 500, 500)").run(invId);

    const inv2 = db.prepare(
      "INSERT INTO invoices (client_id, invoice_number, status, due_date, sent_at, total_amount) VALUES (?, 'INV-0003', 'sent', '2026-04-01', '2026-03-15', 800)"
    ).run(clientId).lastInsertRowid;
    db.prepare("INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (?, 'More work', 1, 800, 800)").run(inv2);

    const health = getClientHealth(db, Number(clientId));
    expect(health.score).toBeLessThan(40);
    expect(health.status).toBe('needs_attention');
    expect(health.balance).toBe(0);
    expect(health.engagement).toBe(0);
  });

  it('returns neutral scores for new client with no invoices or activity', () => {
    const clientId = db.prepare(
      "INSERT INTO clients (name, status) VALUES ('New Client', 'active')"
    ).run().lastInsertRowid as number;

    const health = getClientHealth(db, Number(clientId));
    expect(health.payment).toBe(20);
    expect(health.balance).toBe(30);
    expect(health.engagement).toBe(0);
    expect(health.score).toBe(50);
    expect(health.status).toBe('at_risk');
  });

  it('getClientHealthSummary returns health for all active clients', () => {
    db.prepare("INSERT INTO clients (name, status) VALUES ('Client A', 'active')").run();
    db.prepare("INSERT INTO clients (name, status) VALUES ('Client B', 'active')").run();
    db.prepare("INSERT INTO clients (name, status, deleted_at) VALUES ('Deleted', 'active', datetime('now'))").run();
    db.prepare("INSERT INTO clients (name, status) VALUES ('Completed', 'completed')").run();

    const summary = getClientHealthSummary(db);
    expect(summary).toHaveLength(2);
    expect(summary.every(h => h.status)).toBeTruthy();
  });
});
