import type Database from 'better-sqlite3';
import type { Project, Deliverable, ProjectStatus, DeliverableStatus } from '@/lib/types';

interface CreateProjectInput {
  client_id: number;
  name: string;
  status?: ProjectStatus;
  start_date?: string | null;
  server_ip?: string | null;
  repo_url?: string | null;
  deploy_command?: string | null;
  stack_notes?: string | null;
  hourly_rate?: number | null;
}

interface UpdateProjectInput {
  name?: string;
  status?: ProjectStatus;
  start_date?: string | null;
  server_ip?: string | null;
  repo_url?: string | null;
  deploy_command?: string | null;
  stack_notes?: string | null;
  hourly_rate?: number | null;
}

interface CreateDeliverableInput {
  project_id: number;
  title: string;
  due_date?: string | null;
}

export function createProject(db: Database.Database, input: CreateProjectInput): number {
  const stmt = db.prepare(`
    INSERT INTO projects (client_id, name, status, start_date, server_ip, repo_url, deploy_command, stack_notes, hourly_rate)
    VALUES (@client_id, @name, @status, @start_date, @server_ip, @repo_url, @deploy_command, @stack_notes, @hourly_rate)
  `);

  const result = stmt.run({
    client_id: input.client_id,
    name: input.name,
    status: input.status ?? 'active',
    start_date: input.start_date ?? null,
    server_ip: input.server_ip ?? null,
    repo_url: input.repo_url ?? null,
    deploy_command: input.deploy_command ?? null,
    stack_notes: input.stack_notes ?? null,
    hourly_rate: input.hourly_rate ?? null,
  });

  return Number(result.lastInsertRowid);
}

export function getProjectById(db: Database.Database, id: number): Project | undefined {
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project | undefined;
}

export function listProjectsByClient(db: Database.Database, clientId: number): Project[] {
  return db.prepare('SELECT * FROM projects WHERE client_id = ? ORDER BY created_at DESC').all(clientId) as Project[];
}

export function updateProject(db: Database.Database, id: number, input: UpdateProjectInput): void {
  const fields: string[] = [];
  const params: Record<string, unknown> = { id };

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      fields.push(`${key} = @${key}`);
      params[key] = value;
    }
  }

  if (fields.length === 0) return;

  fields.push("updated_at = datetime('now')");

  db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = @id`).run(params);
}

export function deleteProject(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
}

export function createDeliverable(db: Database.Database, input: CreateDeliverableInput): number {
  const stmt = db.prepare(`
    INSERT INTO deliverables (project_id, title, due_date)
    VALUES (@project_id, @title, @due_date)
  `);

  const result = stmt.run({
    project_id: input.project_id,
    title: input.title,
    due_date: input.due_date ?? null,
  });

  return Number(result.lastInsertRowid);
}

export function listDeliverables(db: Database.Database, projectId: number): Deliverable[] {
  return db
    .prepare('SELECT * FROM deliverables WHERE project_id = ? ORDER BY due_date ASC')
    .all(projectId) as Deliverable[];
}

export function updateDeliverableStatus(db: Database.Database, id: number, status: DeliverableStatus): void {
  const completedAt = status === 'delivered' ? "datetime('now')" : 'NULL';
  db.prepare(`UPDATE deliverables SET status = ?, completed_at = ${completedAt} WHERE id = ?`).run(status, id);
}

export function deleteDeliverable(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM deliverables WHERE id = ?').run(id);
}

// Project progress tracking

export interface ProjectWithProgress {
  id: number;
  client_id: number;
  client_name: string;
  name: string;
  status: string;
  start_date: string | null;
  hourly_rate: number | null;
  total_deliverables: number;
  completed_deliverables: number;
  progress_percent: number;
  total_hours: number;
  total_revenue: number;
}

interface ProjectProgressRow {
  id: number;
  client_id: number;
  client_name: string;
  name: string;
  status: string;
  start_date: string | null;
  hourly_rate: number | null;
}

export function getProjectsWithProgress(db: Database.Database): ProjectWithProgress[] {
  const projects = db.prepare(`
    SELECT p.id, p.client_id, c.name as client_name, p.name, p.status,
           p.start_date, p.hourly_rate
    FROM projects p JOIN clients c ON p.client_id = c.id
    WHERE c.deleted_at IS NULL
    ORDER BY p.status ASC, p.updated_at DESC
  `).all() as ProjectProgressRow[];

  return projects.map(p => {
    const total = (db.prepare('SELECT COUNT(*) as count FROM deliverables WHERE project_id = ?').get(p.id) as { count: number }).count;
    const completed = (db.prepare("SELECT COUNT(*) as count FROM deliverables WHERE project_id = ? AND status = 'delivered'").get(p.id) as { count: number }).count;
    const hours = (db.prepare('SELECT COALESCE(SUM(duration_minutes), 0) as total FROM time_entries WHERE project_id = ?').get(p.id) as { total: number }).total / 60;
    const revenue = (db.prepare('SELECT COALESCE(SUM(duration_minutes * hourly_rate / 60.0), 0) as total FROM time_entries WHERE project_id = ?').get(p.id) as { total: number }).total;

    return {
      ...p,
      total_deliverables: total,
      completed_deliverables: completed,
      progress_percent: total > 0 ? Math.round((completed / total) * 100) : 0,
      total_hours: Math.round(hours * 10) / 10,
      total_revenue: Math.round(revenue),
    };
  });
}
