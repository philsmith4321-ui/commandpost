import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initDb } from '@/lib/db';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-clients.db');

describe('client queries', () => {
  let db: Database.Database;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    db = initDb(TEST_DB_PATH);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('creates and retrieves a client', async () => {
    const { createClient, getClientById } = await import('@/lib/queries/client-queries');

    const id = createClient(db, {
      name: 'Paul Winkler Inc',
      contact_person: 'Paul Winkler',
      email: 'paul@test.com',
      phone: '555-0100',
      notes: 'Financial advisor',
      source: 'referral',
      status: 'active',
      monthly_value: 3000,
    });

    expect(id).toBeGreaterThan(0);

    const client = getClientById(db, id);
    expect(client).toBeTruthy();
    expect(client!.name).toBe('Paul Winkler Inc');
    expect(client!.monthly_value).toBe(3000);
    expect(client!.status).toBe('active');
  });

  it('lists all non-deleted clients', async () => {
    const { createClient, listClients } = await import('@/lib/queries/client-queries');

    createClient(db, { name: 'Client A', status: 'active' });
    createClient(db, { name: 'Client B', status: 'active' });

    const clients = listClients(db);
    expect(clients).toHaveLength(2);
  });

  it('updates a client', async () => {
    const { createClient, updateClient, getClientById } = await import('@/lib/queries/client-queries');

    const id = createClient(db, { name: 'Old Name', status: 'active' });
    updateClient(db, id, { name: 'New Name', monthly_value: 5000 });

    const client = getClientById(db, id);
    expect(client!.name).toBe('New Name');
    expect(client!.monthly_value).toBe(5000);
  });

  it('soft-deletes a client', async () => {
    const { createClient, softDeleteClient, listClients, getClientById } = await import('@/lib/queries/client-queries');

    const id = createClient(db, { name: 'To Delete', status: 'active' });
    softDeleteClient(db, id);

    const clients = listClients(db);
    expect(clients).toHaveLength(0);

    const client = getClientById(db, id);
    expect(client!.deleted_at).toBeTruthy();
  });

  it('filters clients by status', async () => {
    const { createClient, listClients } = await import('@/lib/queries/client-queries');

    createClient(db, { name: 'Active', status: 'active' });
    createClient(db, { name: 'Completed', status: 'completed' });

    const active = listClients(db, { status: 'active' });
    expect(active).toHaveLength(1);
    expect(active[0].name).toBe('Active');
  });

  it('cascades completion to projects when client marked completed', async () => {
    const { createClient, updateClient } = await import('@/lib/queries/client-queries');

    const clientId = createClient(db, { name: 'Test Client', status: 'active' });

    db.prepare('INSERT INTO projects (client_id, name, status) VALUES (?, ?, ?)').run(clientId, 'Project A', 'active');

    updateClient(db, clientId, { status: 'completed' });

    const project = db.prepare('SELECT status FROM projects WHERE client_id = ?').get(clientId) as any;
    expect(project.status).toBe('completed');
  });
});
