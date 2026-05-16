import type Database from 'better-sqlite3';
import crypto from 'crypto';

interface CreateProposalInput {
  title: string;
  lead_id?: number | null;
  client_id?: number | null;
  scope: string | null;
  timeline: string | null;
  valid_until: string | null;
}

interface ProposalItemInput {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export interface ProposalRow {
  id: number;
  lead_id: number | null;
  client_id: number | null;
  title: string;
  scope: string | null;
  timeline: string | null;
  valid_until: string | null;
  status: string;
  token: string | null;
  accepted_at: string | null;
  accepted_ip: string | null;
  created_at: string;
  updated_at: string;
  lead_name: string | null;
  client_name: string | null;
  total_amount: number;
}

export interface ProposalItem {
  id: number;
  proposal_id: number;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export function createProposal(db: Database.Database, input: CreateProposalInput): number {
  const result = db.prepare(`
    INSERT INTO proposals (title, lead_id, client_id, scope, timeline, valid_until)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(input.title, input.lead_id ?? null, input.client_id ?? null, input.scope, input.timeline, input.valid_until);
  return Number(result.lastInsertRowid);
}

export function getProposalById(db: Database.Database, id: number): ProposalRow | undefined {
  return db.prepare(`
    SELECT p.*,
      l.business_name as lead_name,
      c.name as client_name,
      COALESCE((SELECT SUM(amount) FROM proposal_items WHERE proposal_id = p.id), 0) as total_amount
    FROM proposals p
    LEFT JOIN leads l ON p.lead_id = l.id
    LEFT JOIN clients c ON p.client_id = c.id
    WHERE p.id = ?
  `).get(id) as ProposalRow | undefined;
}

export function listProposals(db: Database.Database, status?: string): ProposalRow[] {
  let sql = `
    SELECT p.*,
      l.business_name as lead_name,
      c.name as client_name,
      COALESCE((SELECT SUM(amount) FROM proposal_items WHERE proposal_id = p.id), 0) as total_amount
    FROM proposals p
    LEFT JOIN leads l ON p.lead_id = l.id
    LEFT JOIN clients c ON p.client_id = c.id
  `;
  const params: any[] = [];
  if (status) {
    sql += ' WHERE p.status = ?';
    params.push(status);
  }
  sql += ' ORDER BY p.created_at DESC';
  return db.prepare(sql).all(...params) as ProposalRow[];
}

export function getProposalByToken(db: Database.Database, token: string): ProposalRow | undefined {
  return db.prepare(`
    SELECT p.*,
      l.business_name as lead_name,
      c.name as client_name,
      COALESCE((SELECT SUM(amount) FROM proposal_items WHERE proposal_id = p.id), 0) as total_amount
    FROM proposals p
    LEFT JOIN leads l ON p.lead_id = l.id
    LEFT JOIN clients c ON p.client_id = c.id
    WHERE p.token = ?
  `).get(token) as ProposalRow | undefined;
}

export function markProposalSent(db: Database.Database, id: number): string {
  const existing = db.prepare('SELECT token FROM proposals WHERE id = ?').get(id) as { token: string | null } | undefined;
  const token = existing?.token || crypto.randomUUID();
  db.prepare("UPDATE proposals SET status = 'sent', token = ?, updated_at = datetime('now') WHERE id = ?").run(token, id);
  return token;
}

export function updateProposalStatus(db: Database.Database, id: number, status: string): void {
  db.prepare("UPDATE proposals SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
}

export function addProposalItem(db: Database.Database, proposalId: number, item: ProposalItemInput): number {
  const result = db.prepare(`
    INSERT INTO proposal_items (proposal_id, description, quantity, unit_price, amount)
    VALUES (?, ?, ?, ?, ?)
  `).run(proposalId, item.description, item.quantity, item.unit_price, item.amount);
  return Number(result.lastInsertRowid);
}

export function getProposalItems(db: Database.Database, proposalId: number): ProposalItem[] {
  return db.prepare('SELECT * FROM proposal_items WHERE proposal_id = ? ORDER BY id').all(proposalId) as ProposalItem[];
}

export function getProposalTotal(db: Database.Database, proposalId: number): number {
  const row = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM proposal_items WHERE proposal_id = ?').get(proposalId) as { total: number };
  return row.total;
}

export function deleteProposalItems(db: Database.Database, proposalId: number): void {
  db.prepare('DELETE FROM proposal_items WHERE proposal_id = ?').run(proposalId);
}
