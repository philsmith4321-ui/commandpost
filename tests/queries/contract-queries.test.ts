import { describe, it, expect, beforeEach } from 'vitest';
import { initDb } from '@/lib/db';
import {
  createContract,
  listContracts,
  getExpiringContracts,
} from '@/lib/queries/contract-queries';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeEach(() => {
  db = initDb(':memory:');
  db.prepare("INSERT INTO clients (name, status) VALUES ('Acme', 'active')").run();
});

describe('createContract', () => {
  it('creates a contract and returns id', () => {
    const id = createContract(db, {
      client_id: 1,
      proposal_id: null,
      title: 'Website Contract',
      terms_summary: 'Build a website',
      signed_at: '2026-05-16',
      expires_at: '2027-05-16',
    });
    expect(id).toBe(1);
  });
});

describe('listContracts', () => {
  it('lists contracts with client name', () => {
    createContract(db, { client_id: 1, proposal_id: null, title: 'C1', terms_summary: null, signed_at: '2026-05-16', expires_at: null });
    const list = listContracts(db);
    expect(list).toHaveLength(1);
    expect(list[0].client_name).toBe('Acme');
  });
});

describe('getExpiringContracts', () => {
  it('returns contracts expiring within N days', () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    createContract(db, { client_id: 1, proposal_id: null, title: 'Expiring', terms_summary: null, signed_at: '2026-01-01', expires_at: tomorrow });
    createContract(db, { client_id: 1, proposal_id: null, title: 'Not expiring', terms_summary: null, signed_at: '2026-01-01', expires_at: '2028-01-01' });
    const expiring = getExpiringContracts(db, 30);
    expect(expiring).toHaveLength(1);
    expect(expiring[0].title).toBe('Expiring');
  });
});
