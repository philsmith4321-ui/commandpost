import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const TEST_DB_PATH = path.join(__dirname, '../../data/test.db');

describe('initDb', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('creates all required tables', async () => {
    const { initDb } = await import('@/lib/db');
    const db = initDb(TEST_DB_PATH);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r: any) => r.name);

    expect(tables).toContain('clients');
    expect(tables).toContain('projects');
    expect(tables).toContain('deliverables');
    expect(tables).toContain('activity_logs');
    expect(tables).toContain('leads');
    expect(tables).toContain('lead_stage_history');
    expect(tables).toContain('lead_notes');
    expect(tables).toContain('invoices');
    expect(tables).toContain('invoice_items');
    expect(tables).toContain('expenses');
    expect(tables).toContain('endpoints');
    expect(tables).toContain('health_checks');
    expect(tables).toContain('incidents');

    db.close();
  });

  it('enables WAL mode', async () => {
    const { initDb } = await import('@/lib/db');
    const db = initDb(TEST_DB_PATH);

    const mode = db.pragma('journal_mode', { simple: true });
    expect(mode).toBe('wal');

    db.close();
  });

  it('enables foreign keys', async () => {
    const { initDb } = await import('@/lib/db');
    const db = initDb(TEST_DB_PATH);

    const fk = db.pragma('foreign_keys', { simple: true });
    expect(fk).toBe(1);

    db.close();
  });
});
