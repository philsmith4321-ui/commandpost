import type Database from 'better-sqlite3';
import type { Lead, LeadNote, LeadStageHistory, LeadStage, LeadSource, LostReason } from '@/lib/types';

interface CreateLeadInput {
  business_name: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  source: LeadSource;
  estimated_value?: number | null;
  follow_up_date?: string | null;
}

interface UpdateLeadInput {
  business_name?: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  source?: LeadSource;
  estimated_value?: number | null;
  follow_up_date?: string | null;
}

export interface PipelineSummary {
  totalLeads: number;
  totalValue: number;
  needsFollowUp: number;
}

export type LeadsByStage = Record<LeadStage, Lead[]>;

export function createLead(db: Database.Database, input: CreateLeadInput): number {
  const result = db.prepare(`
    INSERT INTO leads (business_name, contact_person, email, phone, website, source, estimated_value, follow_up_date)
    VALUES (@business_name, @contact_person, @email, @phone, @website, @source, @estimated_value, @follow_up_date)
  `).run({
    business_name: input.business_name,
    contact_person: input.contact_person ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    website: input.website ?? null,
    source: input.source,
    estimated_value: input.estimated_value ?? null,
    follow_up_date: input.follow_up_date ?? null,
  });

  const id = Number(result.lastInsertRowid);

  db.prepare('INSERT INTO lead_stage_history (lead_id, stage) VALUES (?, ?)').run(id, 'new');

  return id;
}

export function getLeadById(db: Database.Database, id: number): Lead | undefined {
  return db.prepare('SELECT * FROM leads WHERE id = ?').get(id) as Lead | undefined;
}

export function listLeadsByStage(db: Database.Database): LeadsByStage {
  const allLeads = db.prepare("SELECT * FROM leads WHERE stage != 'won' AND stage != 'lost' ORDER BY updated_at DESC").all() as Lead[];

  const stages: LeadStage[] = ['new', 'contacted', 'discovery', 'proposal', 'negotiating', 'won', 'lost'];
  const byStage: LeadsByStage = {} as LeadsByStage;
  for (const s of stages) {
    byStage[s] = [];
  }
  for (const lead of allLeads) {
    byStage[lead.stage].push(lead);
  }
  return byStage;
}

export function listAllLeads(db: Database.Database): Lead[] {
  return db.prepare('SELECT * FROM leads ORDER BY updated_at DESC').all() as Lead[];
}

export function updateLead(db: Database.Database, id: number, input: UpdateLeadInput): void {
  const fields: string[] = [];
  const params: any = { id };

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      fields.push(`${key} = @${key}`);
      params[key] = value;
    }
  }

  if (fields.length === 0) return;
  fields.push("updated_at = datetime('now')");

  db.prepare(`UPDATE leads SET ${fields.join(', ')} WHERE id = @id`).run(params);
}

export function updateLeadStage(db: Database.Database, id: number, stage: LeadStage): void {
  db.prepare("UPDATE leads SET stage = ?, updated_at = datetime('now') WHERE id = ?").run(stage, id);
  db.prepare('INSERT INTO lead_stage_history (lead_id, stage) VALUES (?, ?)').run(id, stage);
}

export function markLeadLost(db: Database.Database, id: number, reason: LostReason): void {
  db.prepare("UPDATE leads SET stage = 'lost', lost_reason = ?, updated_at = datetime('now') WHERE id = ?").run(reason, id);
  db.prepare("INSERT INTO lead_stage_history (lead_id, stage) VALUES (?, 'lost')").run(id);
}

export function markLeadWon(db: Database.Database, id: number, clientId: number): void {
  db.prepare("UPDATE leads SET stage = 'won', converted_client_id = ?, updated_at = datetime('now') WHERE id = ?").run(clientId, id);
  db.prepare("INSERT INTO lead_stage_history (lead_id, stage) VALUES (?, 'won')").run(id);
}

export function addLeadNote(db: Database.Database, leadId: number, content: string): number {
  const result = db.prepare('INSERT INTO lead_notes (lead_id, content) VALUES (?, ?)').run(leadId, content);
  db.prepare("UPDATE leads SET updated_at = datetime('now') WHERE id = ?").run(leadId);
  return Number(result.lastInsertRowid);
}

export function listLeadNotes(db: Database.Database, leadId: number): LeadNote[] {
  return db.prepare('SELECT * FROM lead_notes WHERE lead_id = ? ORDER BY id DESC').all(leadId) as LeadNote[];
}

export function getStageHistory(db: Database.Database, leadId: number): LeadStageHistory[] {
  return db.prepare('SELECT * FROM lead_stage_history WHERE lead_id = ? ORDER BY entered_at ASC').all(leadId) as LeadStageHistory[];
}

export function getPipelineSummary(db: Database.Database): PipelineSummary {
  const totalLeads = (db.prepare("SELECT COUNT(*) as count FROM leads WHERE stage NOT IN ('won','lost')").get() as any).count;
  const totalValue = (db.prepare("SELECT COALESCE(SUM(estimated_value), 0) as total FROM leads WHERE stage NOT IN ('won','lost')").get() as any).total;
  const needsFollowUp = (db.prepare("SELECT COUNT(*) as count FROM leads WHERE stage NOT IN ('won','lost') AND follow_up_date < date('now')").get() as any).count;
  return { totalLeads, totalValue, needsFollowUp };
}

export function deleteLead(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM leads WHERE id = ?').run(id);
}
