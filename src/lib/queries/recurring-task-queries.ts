import type Database from 'better-sqlite3';

export interface RecurringTask {
  id: number;
  client_id: number;
  project_id: number | null;
  title: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  day_of_week: number | null;
  day_of_month: number | null;
  last_generated_at: string | null;
  is_active: number;
  created_at: string;
}

export function listRecurringTasks(db: Database.Database): (RecurringTask & { client_name: string; project_name: string | null })[] {
  return db.prepare(`
    SELECT rt.*, c.name as client_name, p.name as project_name
    FROM recurring_tasks rt
    JOIN clients c ON rt.client_id = c.id
    LEFT JOIN projects p ON rt.project_id = p.id
    WHERE c.deleted_at IS NULL
    ORDER BY rt.title
  `).all() as (RecurringTask & { client_name: string; project_name: string | null })[];
}

export function getDueRecurringTasks(db: Database.Database): RecurringTask[] {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const dayOfMonth = today.getDate();
  const todayStr = today.toISOString().split('T')[0];

  return db.prepare(`
    SELECT * FROM recurring_tasks WHERE is_active = 1 AND (
      (frequency = 'daily' AND (last_generated_at IS NULL OR last_generated_at < ?))
      OR (frequency = 'weekly' AND day_of_week = ? AND (last_generated_at IS NULL OR last_generated_at < ?))
      OR (frequency = 'monthly' AND day_of_month = ? AND (last_generated_at IS NULL OR last_generated_at < ?))
    )
  `).all(todayStr, dayOfWeek, todayStr, dayOfMonth, todayStr) as RecurringTask[];
}

export function createRecurringTask(db: Database.Database, data: {
  client_id: number;
  project_id?: number;
  title: string;
  frequency: string;
  day_of_week?: number;
  day_of_month?: number;
}): number {
  const result = db.prepare(`
    INSERT INTO recurring_tasks (client_id, project_id, title, frequency, day_of_week, day_of_month)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(data.client_id, data.project_id || null, data.title, data.frequency, data.day_of_week ?? null, data.day_of_month ?? null);
  return Number(result.lastInsertRowid);
}

export function markTaskGenerated(db: Database.Database, taskId: number): void {
  db.prepare("UPDATE recurring_tasks SET last_generated_at = date('now') WHERE id = ?").run(taskId);
}

export function toggleRecurringTask(db: Database.Database, id: number): void {
  db.prepare('UPDATE recurring_tasks SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END WHERE id = ?').run(id);
}

export function deleteRecurringTask(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM recurring_tasks WHERE id = ?').run(id);
}
