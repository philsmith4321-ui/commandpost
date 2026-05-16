import { describe, it, expect, beforeEach } from 'vitest';
import { initDb } from '@/lib/db';
import {
  createProposal,
  getProposalById,
  listProposals,
  getProposalByToken,
  markProposalSent,
  updateProposalStatus,
  addProposalItem,
  getProposalItems,
  getProposalTotal,
} from '@/lib/queries/proposal-queries';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeEach(() => {
  db = initDb(':memory:');
  db.prepare("INSERT INTO leads (business_name, stage) VALUES ('Acme Corp', 'proposal')").run();
  db.prepare("INSERT INTO clients (name, status) VALUES ('Existing Co', 'active')").run();
});

describe('createProposal', () => {
  it('creates a proposal and returns id', () => {
    const id = createProposal(db, { title: 'Website Build', lead_id: 1, scope: 'Full site', timeline: '4 weeks', valid_until: '2026-07-01' });
    expect(id).toBe(1);
  });
});

describe('getProposalById', () => {
  it('returns proposal with lead/client name', () => {
    createProposal(db, { title: 'Website Build', lead_id: 1, scope: null, timeline: null, valid_until: null });
    const p = getProposalById(db, 1);
    expect(p).toBeDefined();
    expect(p!.title).toBe('Website Build');
    expect(p!.lead_name).toBe('Acme Corp');
  });
});

describe('listProposals', () => {
  it('lists all proposals', () => {
    createProposal(db, { title: 'P1', lead_id: 1, scope: null, timeline: null, valid_until: null });
    createProposal(db, { title: 'P2', client_id: 1, scope: null, timeline: null, valid_until: null });
    const list = listProposals(db);
    expect(list).toHaveLength(2);
  });

  it('filters by status', () => {
    createProposal(db, { title: 'P1', lead_id: 1, scope: null, timeline: null, valid_until: null });
    const list = listProposals(db, 'sent');
    expect(list).toHaveLength(0);
  });
});

describe('markProposalSent', () => {
  it('sets status to sent and generates token', () => {
    createProposal(db, { title: 'P1', lead_id: 1, scope: null, timeline: null, valid_until: null });
    const token = markProposalSent(db, 1);
    expect(token).toMatch(/^[0-9a-f-]{36}$/);
    const p = getProposalById(db, 1);
    expect(p!.status).toBe('sent');
  });
});

describe('getProposalByToken', () => {
  it('returns proposal for valid token', () => {
    createProposal(db, { title: 'P1', lead_id: 1, scope: null, timeline: null, valid_until: null });
    const token = markProposalSent(db, 1);
    const p = getProposalByToken(db, token);
    expect(p).toBeDefined();
    expect(p!.title).toBe('P1');
  });

  it('returns undefined for bad token', () => {
    expect(getProposalByToken(db, 'invalid')).toBeUndefined();
  });
});

describe('proposal items', () => {
  it('adds items and calculates total', () => {
    createProposal(db, { title: 'P1', lead_id: 1, scope: null, timeline: null, valid_until: null });
    addProposalItem(db, 1, { description: 'Design', quantity: 1, unit_price: 2000, amount: 2000 });
    addProposalItem(db, 1, { description: 'Dev', quantity: 10, unit_price: 150, amount: 1500 });
    const items = getProposalItems(db, 1);
    expect(items).toHaveLength(2);
    expect(getProposalTotal(db, 1)).toBe(3500);
  });
});
