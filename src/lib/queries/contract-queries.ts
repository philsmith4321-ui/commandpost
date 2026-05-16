import type Database from 'better-sqlite3';

interface CreateContractInput {
  client_id: number;
  proposal_id: number | null;
  title: string;
  terms_summary: string | null;
  signed_at: string;
  expires_at: string | null;
}

export interface ContractRow {
  id: number;
  client_id: number;
  proposal_id: number | null;
  title: string;
  terms_summary: string | null;
  signed_at: string;
  expires_at: string | null;
  status: string;
  created_at: string;
  client_name: string;
}

export function createContract(db: Database.Database, input: CreateContractInput): number {
  const result = db.prepare(`
    INSERT INTO contracts (client_id, proposal_id, title, terms_summary, signed_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(input.client_id, input.proposal_id, input.title, input.terms_summary, input.signed_at, input.expires_at);
  return Number(result.lastInsertRowid);
}

export function listContracts(db: Database.Database): ContractRow[] {
  return db.prepare(`
    SELECT ct.*, c.name as client_name
    FROM contracts ct
    JOIN clients c ON ct.client_id = c.id
    ORDER BY ct.created_at DESC
  `).all() as ContractRow[];
}

export function getExpiringContracts(db: Database.Database, withinDays: number): ContractRow[] {
  return db.prepare(`
    SELECT ct.*, c.name as client_name
    FROM contracts ct
    JOIN clients c ON ct.client_id = c.id
    WHERE ct.status = 'active'
      AND ct.expires_at IS NOT NULL
      AND ct.expires_at <= date('now', '+' || ? || ' days')
      AND ct.expires_at >= date('now')
    ORDER BY ct.expires_at ASC
  `).all(withinDays) as ContractRow[];
}
