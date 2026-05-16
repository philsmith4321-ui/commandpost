import type Database from 'better-sqlite3';

export interface OnboardingTemplate {
  id: number;
  name: string;
  items: { id: number; title: string; sort_order: number }[];
}

export interface OnboardingChecklist {
  id: number;
  client_id: number;
  template_name: string;
  created_at: string;
  items: OnboardingItem[];
  progress: number;
}

export interface OnboardingItem {
  id: number;
  checklist_id: number;
  title: string;
  is_done: number;
  completed_at: string | null;
  sort_order: number;
}

export function listOnboardingTemplates(db: Database.Database): OnboardingTemplate[] {
  const templates = db.prepare('SELECT * FROM onboarding_templates ORDER BY name').all() as any[];
  return templates.map(t => ({
    ...t,
    items: db.prepare('SELECT * FROM onboarding_template_items WHERE template_id = ? ORDER BY sort_order').all(t.id) as any[],
  }));
}

export function createOnboardingTemplate(db: Database.Database, name: string, items: string[]): number {
  const result = db.prepare('INSERT INTO onboarding_templates (name) VALUES (?)').run(name);
  const templateId = Number(result.lastInsertRowid);
  const stmt = db.prepare('INSERT INTO onboarding_template_items (template_id, title, sort_order) VALUES (?, ?, ?)');
  items.forEach((item, i) => stmt.run(templateId, item, i));
  return templateId;
}

export function deleteOnboardingTemplate(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM onboarding_templates WHERE id = ?').run(id);
}

export function getClientChecklists(db: Database.Database, clientId: number): OnboardingChecklist[] {
  const checklists = db.prepare('SELECT * FROM onboarding_checklists WHERE client_id = ? ORDER BY created_at DESC').all(clientId) as any[];
  return checklists.map(c => {
    const items = db.prepare('SELECT * FROM onboarding_items WHERE checklist_id = ? ORDER BY sort_order').all(c.id) as OnboardingItem[];
    const done = items.filter(i => i.is_done).length;
    return { ...c, items, progress: items.length > 0 ? Math.round((done / items.length) * 100) : 0 };
  });
}

export function startOnboarding(db: Database.Database, clientId: number, templateId: number): number {
  const template = db.prepare('SELECT * FROM onboarding_templates WHERE id = ?').get(templateId) as any;
  if (!template) return 0;

  const items = db.prepare('SELECT * FROM onboarding_template_items WHERE template_id = ? ORDER BY sort_order').all(templateId) as any[];

  const result = db.prepare('INSERT INTO onboarding_checklists (client_id, template_name) VALUES (?, ?)').run(clientId, template.name);
  const checklistId = Number(result.lastInsertRowid);

  const stmt = db.prepare('INSERT INTO onboarding_items (checklist_id, title, sort_order) VALUES (?, ?, ?)');
  items.forEach((item: any) => stmt.run(checklistId, item.title, item.sort_order));

  return checklistId;
}

export function toggleOnboardingItem(db: Database.Database, itemId: number): void {
  const item = db.prepare('SELECT * FROM onboarding_items WHERE id = ?').get(itemId) as any;
  if (!item) return;

  if (item.is_done) {
    db.prepare('UPDATE onboarding_items SET is_done = 0, completed_at = NULL WHERE id = ?').run(itemId);
  } else {
    db.prepare("UPDATE onboarding_items SET is_done = 1, completed_at = datetime('now') WHERE id = ?").run(itemId);
  }
}
