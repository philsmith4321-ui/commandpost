import type Database from 'better-sqlite3';
import type { TimeEntry } from '@/lib/types';

interface CreateTimeEntryInput {
  project_id: number;
  deliverable_id?: number | null;
  description?: string | null;
  duration_minutes: number;
  entry_date: string;
  hourly_rate: number;
}

export function createTimeEntry(db: Database.Database, input: CreateTimeEntryInput): number {
  const stmt = db.prepare(`
    INSERT INTO time_entries (project_id, deliverable_id, description, duration_minutes, entry_date, hourly_rate)
    VALUES (@project_id, @deliverable_id, @description, @duration_minutes, @entry_date, @hourly_rate)
  `);
  const result = stmt.run({
    project_id: input.project_id,
    deliverable_id: input.deliverable_id ?? null,
    description: input.description ?? null,
    duration_minutes: input.duration_minutes,
    entry_date: input.entry_date,
    hourly_rate: input.hourly_rate,
  });
  return Number(result.lastInsertRowid);
}

export function deleteTimeEntry(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM time_entries WHERE id = ? AND is_invoiced = 0').run(id);
}

export function getTimeEntriesByProject(db: Database.Database, projectId: number): TimeEntry[] {
  return db.prepare('SELECT * FROM time_entries WHERE project_id = ? ORDER BY entry_date DESC').all(projectId) as TimeEntry[];
}

export function getUninvoicedByProject(db: Database.Database, projectId: number): TimeEntry[] {
  return db.prepare('SELECT * FROM time_entries WHERE project_id = ? AND is_invoiced = 0 ORDER BY entry_date DESC').all(projectId) as TimeEntry[];
}

export function getUninvoicedByClient(db: Database.Database, clientId: number): TimeEntry[] {
  return db.prepare(`
    SELECT te.* FROM time_entries te
    JOIN projects p ON te.project_id = p.id
    WHERE p.client_id = ? AND te.is_invoiced = 0
    ORDER BY te.entry_date DESC
  `).all(clientId) as TimeEntry[];
}

export interface ProjectTimeSummary {
  totalHours: number;
  totalCost: number;
  uninvoicedHours: number;
  uninvoicedCost: number;
}

export function getProjectTimeSummary(db: Database.Database, projectId: number): ProjectTimeSummary {
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(duration_minutes), 0) as total_minutes,
      COALESCE(SUM(duration_minutes * hourly_rate / 60.0), 0) as total_cost,
      COALESCE(SUM(CASE WHEN is_invoiced = 0 THEN duration_minutes ELSE 0 END), 0) as uninvoiced_minutes,
      COALESCE(SUM(CASE WHEN is_invoiced = 0 THEN duration_minutes * hourly_rate / 60.0 ELSE 0 END), 0) as uninvoiced_cost
    FROM time_entries WHERE project_id = ?
  `).get(projectId) as any;

  return {
    totalHours: row.total_minutes / 60,
    totalCost: row.total_cost,
    uninvoicedHours: row.uninvoiced_minutes / 60,
    uninvoicedCost: row.uninvoiced_cost,
  };
}

export function getDeliverableHours(db: Database.Database, projectId: number): Record<number, number> {
  const rows = db.prepare(`
    SELECT deliverable_id, SUM(duration_minutes) as total_minutes
    FROM time_entries
    WHERE project_id = ? AND deliverable_id IS NOT NULL
    GROUP BY deliverable_id
  `).all(projectId) as any[];

  const result: Record<number, number> = {};
  for (const row of rows) {
    result[row.deliverable_id] = row.total_minutes / 60;
  }
  return result;
}

export interface TimeStats {
  hoursThisMonth: number;
  uninvoicedTotal: number;
  uninvoicedHours: number;
}

export function getTimeStats(db: Database.Database): TimeStats {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const row = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN entry_date >= ? THEN duration_minutes ELSE 0 END), 0) as month_minutes,
      COALESCE(SUM(CASE WHEN is_invoiced = 0 THEN duration_minutes * hourly_rate / 60.0 ELSE 0 END), 0) as uninvoiced_total,
      COALESCE(SUM(CASE WHEN is_invoiced = 0 THEN duration_minutes ELSE 0 END), 0) as uninvoiced_minutes
    FROM time_entries
  `).get(monthStart) as any;

  return {
    hoursThisMonth: row.month_minutes / 60,
    uninvoicedTotal: row.uninvoiced_total,
    uninvoicedHours: row.uninvoiced_minutes / 60,
  };
}

export interface TimeEntryWithDetails extends TimeEntry {
  client_name: string;
  project_name: string;
  deliverable_title: string | null;
}

export function getTimeEntriesFiltered(
  db: Database.Database,
  filters: { clientId?: number; projectId?: number; startDate?: string; endDate?: string; invoiced?: boolean }
): TimeEntryWithDetails[] {
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters.clientId) {
    conditions.push('p.client_id = ?');
    params.push(filters.clientId);
  }
  if (filters.projectId) {
    conditions.push('te.project_id = ?');
    params.push(filters.projectId);
  }
  if (filters.startDate) {
    conditions.push('te.entry_date >= ?');
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    conditions.push('te.entry_date <= ?');
    params.push(filters.endDate);
  }
  if (filters.invoiced !== undefined) {
    conditions.push('te.is_invoiced = ?');
    params.push(filters.invoiced ? 1 : 0);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return db.prepare(`
    SELECT te.*, c.name as client_name, p.name as project_name, d.title as deliverable_title
    FROM time_entries te
    JOIN projects p ON te.project_id = p.id
    JOIN clients c ON p.client_id = c.id
    LEFT JOIN deliverables d ON te.deliverable_id = d.id
    ${where}
    ORDER BY te.entry_date DESC
  `).all(...params) as TimeEntryWithDetails[];
}

export function markEntriesInvoiced(db: Database.Database, entryIds: number[], invoiceId: number): void {
  const placeholders = entryIds.map(() => '?').join(',');
  db.prepare(`UPDATE time_entries SET is_invoiced = 1, invoice_id = ? WHERE id IN (${placeholders})`).run(invoiceId, ...entryIds);
}
