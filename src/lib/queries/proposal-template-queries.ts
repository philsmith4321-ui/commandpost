import type Database from 'better-sqlite3';

export interface ProposalTemplate {
  id: number;
  name: string;
  scope: string | null;
  timeline: string | null;
  valid_days: number;
  created_at: string;
  items: ProposalTemplateItem[];
}

export interface ProposalTemplateItem {
  id: number;
  template_id: number;
  description: string;
  quantity: number;
  unit_price: number;
}

export function listProposalTemplates(db: Database.Database): ProposalTemplate[] {
  const templates = db.prepare("SELECT * FROM proposal_templates ORDER BY name").all() as Omit<ProposalTemplate, 'items'>[];
  return templates.map(t => ({
    ...t,
    items: db.prepare("SELECT * FROM proposal_template_items WHERE template_id = ? ORDER BY id").all(t.id) as ProposalTemplateItem[],
  }));
}

export function getProposalTemplate(db: Database.Database, id: number): ProposalTemplate | undefined {
  const t = db.prepare("SELECT * FROM proposal_templates WHERE id = ?").get(id) as Omit<ProposalTemplate, 'items'> | undefined;
  if (!t) return undefined;
  return {
    ...t,
    items: db.prepare("SELECT * FROM proposal_template_items WHERE template_id = ? ORDER BY id").all(id) as ProposalTemplateItem[],
  };
}

export function createProposalTemplate(db: Database.Database, input: {
  name: string; scope?: string; timeline?: string; valid_days?: number;
  items: { description: string; quantity: number; unit_price: number }[];
}): number {
  const result = db.prepare(
    "INSERT INTO proposal_templates (name, scope, timeline, valid_days) VALUES (?, ?, ?, ?)"
  ).run(input.name, input.scope || null, input.timeline || null, input.valid_days || 30);
  const id = Number(result.lastInsertRowid);
  const stmt = db.prepare("INSERT INTO proposal_template_items (template_id, description, quantity, unit_price) VALUES (?, ?, ?, ?)");
  for (const item of input.items) {
    stmt.run(id, item.description, item.quantity, item.unit_price);
  }
  return id;
}

export function deleteProposalTemplate(db: Database.Database, id: number): void {
  db.prepare("DELETE FROM proposal_templates WHERE id = ?").run(id);
}
