import type Database from 'better-sqlite3';

export interface AutomationRow {
  id: number;
  name: string;
  trigger_type: string;
  trigger_value: string | null;
  action_type: string;
  action_config: string | null;
  enabled: number;
  last_run: string | null;
  created_at: string;
}

export interface AutomationLogRow {
  id: number;
  automation_id: number;
  trigger_detail: string | null;
  action_detail: string | null;
  ran_at: string;
}

export const TRIGGER_TYPES = [
  { value: 'invoice_overdue', label: 'Invoice becomes overdue' },
  { value: 'lead_stage_change', label: 'Lead stage changes' },
  { value: 'proposal_accepted', label: 'Proposal accepted' },
  { value: 'project_completed', label: 'Project completed' },
  { value: 'invoice_paid', label: 'Invoice paid' },
  { value: 'client_inactive', label: 'Client inactive (30+ days)' },
] as const;

export const ACTION_TYPES = [
  { value: 'send_email', label: 'Send email notification' },
  { value: 'create_notification', label: 'Create in-app notification' },
  { value: 'update_status', label: 'Update status' },
  { value: 'create_followup', label: 'Create follow-up reminder' },
] as const;

export function listAutomations(db: Database.Database): AutomationRow[] {
  return db.prepare('SELECT * FROM automations ORDER BY created_at DESC').all() as AutomationRow[];
}

export function getAutomation(db: Database.Database, id: number): AutomationRow | undefined {
  return db.prepare('SELECT * FROM automations WHERE id = ?').get(id) as AutomationRow | undefined;
}

export function createAutomation(db: Database.Database, input: {
  name: string;
  trigger_type: string;
  trigger_value?: string | null;
  action_type: string;
  action_config?: string | null;
}): number {
  const result = db.prepare(
    'INSERT INTO automations (name, trigger_type, trigger_value, action_type, action_config) VALUES (?, ?, ?, ?, ?)'
  ).run(input.name, input.trigger_type, input.trigger_value ?? null, input.action_type, input.action_config ?? null);
  return Number(result.lastInsertRowid);
}

export function toggleAutomation(db: Database.Database, id: number): void {
  db.prepare('UPDATE automations SET enabled = CASE WHEN enabled = 1 THEN 0 ELSE 1 END WHERE id = ?').run(id);
}

export function deleteAutomation(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM automations WHERE id = ?').run(id);
}

export function logAutomationRun(db: Database.Database, automationId: number, triggerDetail: string, actionDetail: string): void {
  db.prepare('INSERT INTO automation_log (automation_id, trigger_detail, action_detail) VALUES (?, ?, ?)').run(automationId, triggerDetail, actionDetail);
  db.prepare("UPDATE automations SET last_run = datetime('now') WHERE id = ?").run(automationId);
}

export function getAutomationLogs(db: Database.Database, limit = 50): AutomationLogRow[] {
  return db.prepare('SELECT * FROM automation_log ORDER BY ran_at DESC LIMIT ?').all(limit) as AutomationLogRow[];
}

export function getEnabledAutomationsByTrigger(db: Database.Database, triggerType: string): AutomationRow[] {
  return db.prepare('SELECT * FROM automations WHERE trigger_type = ? AND enabled = 1').all(triggerType) as AutomationRow[];
}
