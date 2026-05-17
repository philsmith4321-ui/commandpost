import type Database from 'better-sqlite3';

export interface Milestone {
  id: number;
  project_id: number;
  title: string;
  start_date: string;
  end_date: string;
  status: string;
  color: string;
  project_name?: string;
  client_name?: string;
}

export function listMilestones(db: Database.Database, projectId?: number): Milestone[] {
  if (projectId) {
    return db.prepare(
      "SELECT m.*, p.name as project_name, c.name as client_name FROM milestones m JOIN projects p ON p.id = m.project_id JOIN clients c ON c.id = p.client_id WHERE m.project_id = ? ORDER BY m.start_date"
    ).all(projectId) as Milestone[];
  }
  return db.prepare(
    "SELECT m.*, p.name as project_name, c.name as client_name FROM milestones m JOIN projects p ON p.id = m.project_id JOIN clients c ON c.id = p.client_id ORDER BY m.start_date"
  ).all() as Milestone[];
}

export function createMilestone(db: Database.Database, input: { project_id: number; title: string; start_date: string; end_date: string; color?: string }): number {
  const result = db.prepare(
    "INSERT INTO milestones (project_id, title, start_date, end_date, color) VALUES (?, ?, ?, ?, ?)"
  ).run(input.project_id, input.title, input.start_date, input.end_date, input.color || 'blue');
  return Number(result.lastInsertRowid);
}

export function updateMilestoneStatus(db: Database.Database, id: number, status: string): void {
  db.prepare("UPDATE milestones SET status = ? WHERE id = ?").run(status, id);
}

export function deleteMilestone(db: Database.Database, id: number): void {
  db.prepare("DELETE FROM milestones WHERE id = ?").run(id);
}
