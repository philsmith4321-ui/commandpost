import { describe, it, expect, beforeEach } from 'vitest';
import { initDb } from '@/lib/db';
import {
  getClientByPortalToken,
  getPortalProjects,
  getPortalInvoices,
  getPortalActivity,
  generatePortalToken,
  resetPortalToken,
} from '@/lib/queries/portal-queries';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeEach(() => {
  db = initDb(':memory:');
});

describe('generatePortalToken', () => {
  it('creates a token for client', () => {
    db.prepare("INSERT INTO clients (name, status) VALUES ('Acme', 'active')").run();
    const token = generatePortalToken(db, 1);
    expect(token).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('returns existing token if already set', () => {
    db.prepare("INSERT INTO clients (name, status) VALUES ('Acme', 'active')").run();
    const token1 = generatePortalToken(db, 1);
    const token2 = generatePortalToken(db, 1);
    expect(token1).toBe(token2);
  });
});

describe('resetPortalToken', () => {
  it('generates a new token replacing old one', () => {
    db.prepare("INSERT INTO clients (name, status) VALUES ('Acme', 'active')").run();
    const token1 = generatePortalToken(db, 1);
    const token2 = resetPortalToken(db, 1);
    expect(token2).not.toBe(token1);
    expect(token2).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('getClientByPortalToken', () => {
  it('returns client for valid token', () => {
    db.prepare("INSERT INTO clients (name, status) VALUES ('Acme', 'active')").run();
    const token = generatePortalToken(db, 1);
    const client = getClientByPortalToken(db, token);
    expect(client).toBeDefined();
    expect(client!.name).toBe('Acme');
  });

  it('returns undefined for invalid token', () => {
    const client = getClientByPortalToken(db, 'bad-token');
    expect(client).toBeUndefined();
  });

  it('returns undefined for deleted client', () => {
    db.prepare("INSERT INTO clients (name, status, deleted_at) VALUES ('Acme', 'active', datetime('now'))").run();
    const token = generatePortalToken(db, 1);
    const client = getClientByPortalToken(db, token);
    expect(client).toBeUndefined();
  });
});

describe('getPortalProjects', () => {
  it('returns active projects with deliverables', () => {
    db.prepare("INSERT INTO clients (name, status) VALUES ('Acme', 'active')").run();
    db.prepare("INSERT INTO projects (client_id, name, status) VALUES (1, 'Website', 'active')").run();
    db.prepare("INSERT INTO deliverables (project_id, title, status) VALUES (1, 'Homepage', 'delivered')").run();
    db.prepare("INSERT INTO deliverables (project_id, title, status) VALUES (1, 'About page', 'in_progress')").run();

    const projects = getPortalProjects(db, 1);
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe('Website');
    expect(projects[0].deliverables).toHaveLength(2);
  });

  it('excludes completed projects', () => {
    db.prepare("INSERT INTO clients (name, status) VALUES ('Acme', 'active')").run();
    db.prepare("INSERT INTO projects (client_id, name, status) VALUES (1, 'Old', 'completed')").run();
    db.prepare("INSERT INTO projects (client_id, name, status) VALUES (1, 'Current', 'active')").run();

    const projects = getPortalProjects(db, 1);
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe('Current');
  });
});

describe('getPortalInvoices', () => {
  it('returns outstanding and recent invoices', () => {
    db.prepare("INSERT INTO clients (name, status) VALUES ('Acme', 'active')").run();
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, total_amount) VALUES (1, 'INV-001', 'sent', '2026-06-01', 1000)").run();
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, total_amount, paid_at) VALUES (1, 'INV-002', 'paid', '2026-04-01', 500, '2026-04-05')").run();

    const invoices = getPortalInvoices(db, 1);
    expect(invoices.length).toBeGreaterThanOrEqual(1);
    expect(invoices[0].invoice_number).toBe('INV-001');
  });
});

describe('getPortalActivity', () => {
  it('returns recent notifications for client', () => {
    db.prepare("INSERT INTO clients (name, status) VALUES ('Acme', 'active')").run();
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, total_amount) VALUES (1, 'INV-001', 'paid', '2026-04-01', 500)").run();
    db.prepare("INSERT INTO notifications (type, title, message, link) VALUES ('invoice_paid', 'Invoice paid', '$500', '/finances/invoices/1')").run();

    const activity = getPortalActivity(db, 1);
    expect(activity).toHaveLength(1);
    expect(activity[0].title).toBe('Invoice paid');
  });
});
