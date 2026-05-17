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

export interface DuplicateGroup {
  email?: string;
  business_name?: string;
  leads: Lead[];
}

export function findDuplicateLeads(db: Database.Database): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];

  // Find duplicates by email
  const emailDups = db.prepare(`
    SELECT email, COUNT(*) as cnt FROM leads
    WHERE email IS NOT NULL AND email != '' AND stage NOT IN ('won','lost')
    GROUP BY LOWER(email) HAVING cnt > 1
  `).all() as { email: string; cnt: number }[];

  for (const dup of emailDups) {
    const leads = db.prepare("SELECT * FROM leads WHERE LOWER(email) = LOWER(?) AND stage NOT IN ('won','lost')").all(dup.email) as Lead[];
    groups.push({ email: dup.email, leads });
  }

  // Find duplicates by business name (exact match)
  const nameDups = db.prepare(`
    SELECT business_name, COUNT(*) as cnt FROM leads
    WHERE stage NOT IN ('won','lost')
    GROUP BY LOWER(business_name) HAVING cnt > 1
  `).all() as { business_name: string; cnt: number }[];

  for (const dup of nameDups) {
    // Skip if already caught by email
    const leads = db.prepare("SELECT * FROM leads WHERE LOWER(business_name) = LOWER(?) AND stage NOT IN ('won','lost')").all(dup.business_name) as Lead[];
    const alreadyCovered = groups.some(g => g.leads.some(l => leads.some(dl => dl.id === l.id)));
    if (!alreadyCovered) {
      groups.push({ business_name: dup.business_name, leads });
    }
  }

  return groups;
}

export interface ScoredLead extends Lead {
  score: number;
  score_breakdown: { value: number; engagement: number; stage: number; recency: number };
}

export function getLeadScores(db: Database.Database): ScoredLead[] {
  const leads = db.prepare("SELECT * FROM leads WHERE stage NOT IN ('won','lost') ORDER BY created_at DESC").all() as Lead[];

  const stageScores: Record<string, number> = {
    new: 10, contacted: 20, discovery: 40, proposal: 60, negotiating: 80,
  };

  return leads.map(lead => {
    // Value score (0-25): based on estimated value
    const value = lead.estimated_value
      ? Math.min(25, Math.round((lead.estimated_value / 10000) * 25))
      : 5;

    // Engagement score (0-25): based on notes count
    const noteCount = (db.prepare('SELECT COUNT(*) as count FROM lead_notes WHERE lead_id = ?').get(lead.id) as any).count;
    const engagement = Math.min(25, noteCount * 5);

    // Stage score (0-25): further along = higher
    const stage = Math.round(((stageScores[lead.stage] || 0) / 80) * 25);

    // Recency score (0-25): recent activity = higher
    const lastNote = db.prepare('SELECT created_at FROM lead_notes WHERE lead_id = ? ORDER BY created_at DESC LIMIT 1').get(lead.id) as any;
    let recency = 5;
    if (lastNote) {
      const daysSince = Math.floor((Date.now() - new Date(lastNote.created_at + 'Z').getTime()) / (1000 * 60 * 60 * 24));
      recency = daysSince <= 3 ? 25 : daysSince <= 7 ? 20 : daysSince <= 14 ? 15 : daysSince <= 30 ? 10 : 5;
    }

    const score = value + engagement + stage + recency;
    return { ...lead, score, score_breakdown: { value, engagement, stage, recency } };
  }).sort((a, b) => b.score - a.score);
}
