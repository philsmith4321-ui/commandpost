import type Database from 'better-sqlite3';

export interface ProjectTemplate {
  id: number;
  name: string;
  description: string | null;
  stack_notes: string | null;
  hourly_rate: number | null;
  created_at: string;
}

export interface TemplateDeliverable {
  id: number;
  template_id: number;
  title: string;
  days_offset: number;
}

export function listTemplates(db: Database.Database): ProjectTemplate[] {
  return db.prepare('SELECT * FROM project_templates ORDER BY name ASC').all() as ProjectTemplate[];
}

export function getTemplateById(db: Database.Database, id: number): ProjectTemplate | undefined {
  return db.prepare('SELECT * FROM project_templates WHERE id = ?').get(id) as ProjectTemplate | undefined;
}

export function getTemplateDeliverables(db: Database.Database, templateId: number): TemplateDeliverable[] {
  return db.prepare('SELECT * FROM template_deliverables WHERE template_id = ? ORDER BY days_offset ASC').all(templateId) as TemplateDeliverable[];
}

export function createTemplate(db: Database.Database, data: { name: string; description?: string; stack_notes?: string; hourly_rate?: number }): number {
  const result = db.prepare(
    'INSERT INTO project_templates (name, description, stack_notes, hourly_rate) VALUES (?, ?, ?, ?)'
  ).run(data.name, data.description || null, data.stack_notes || null, data.hourly_rate || null);
  return Number(result.lastInsertRowid);
}

export function addTemplateDeliverable(db: Database.Database, templateId: number, title: string, daysOffset: number): void {
  db.prepare('INSERT INTO template_deliverables (template_id, title, days_offset) VALUES (?, ?, ?)').run(templateId, title, daysOffset);
}

export function deleteTemplate(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM project_templates WHERE id = ?').run(id);
}

export function createProjectFromTemplate(
  db: Database.Database,
  templateId: number,
  clientId: number,
  projectName: string,
  startDate: string
): number {
  const template = getTemplateById(db, templateId);
  if (!template) throw new Error('Template not found');

  const deliverables = getTemplateDeliverables(db, templateId);

  const result = db.prepare(
    'INSERT INTO projects (client_id, name, status, start_date, stack_notes, hourly_rate) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(clientId, projectName, 'active', startDate, template.stack_notes, template.hourly_rate);
  const projectId = Number(result.lastInsertRowid);

  for (const d of deliverables) {
    const dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + d.days_offset);
    const dueDateStr = dueDate.toISOString().split('T')[0];
    db.prepare(
      'INSERT INTO deliverables (project_id, title, status, due_date) VALUES (?, ?, ?, ?)'
    ).run(projectId, d.title, 'not_started', dueDateStr);
  }

  return projectId;
}
