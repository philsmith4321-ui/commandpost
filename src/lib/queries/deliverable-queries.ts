import type Database from 'better-sqlite3';

export interface DeliverableWithContext {
  id: number;
  title: string;
  status: string;
  due_date: string | null;
  project_id: number;
  project_name: string;
  client_id: number;
  client_name: string;
}

export function getAllActiveDeliverables(db: Database.Database): DeliverableWithContext[] {
  return db.prepare(`
    SELECT d.id, d.title, d.status, d.due_date, p.id as project_id, p.name as project_name, c.id as client_id, c.name as client_name
    FROM deliverables d
    JOIN projects p ON d.project_id = p.id
    JOIN clients c ON p.client_id = c.id
    WHERE c.deleted_at IS NULL AND p.status = 'active'
    ORDER BY d.due_date ASC NULLS LAST
  `).all() as DeliverableWithContext[];
}
