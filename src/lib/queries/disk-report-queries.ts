import type Database from 'better-sqlite3';
import type { DiskReport } from '@/lib/types';

interface RecordDiskReportInput {
  endpoint_id: number;
  mount_point: string;
  total_gb: number;
  used_gb: number;
  percent_used: number;
}

export function recordDiskReport(db: Database.Database, input: RecordDiskReportInput): number {
  const result = db.prepare(
    'INSERT INTO disk_reports (endpoint_id, mount_point, total_gb, used_gb, percent_used) VALUES (?, ?, ?, ?, ?)'
  ).run(input.endpoint_id, input.mount_point, input.total_gb, input.used_gb, input.percent_used);
  return Number(result.lastInsertRowid);
}

export function getLatestDiskReports(db: Database.Database, endpointId: number): DiskReport[] {
  return db.prepare(`
    SELECT dr.* FROM disk_reports dr
    INNER JOIN (
      SELECT endpoint_id, mount_point, MAX(reported_at) as max_reported
      FROM disk_reports
      WHERE endpoint_id = ?
      GROUP BY endpoint_id, mount_point
    ) latest ON dr.endpoint_id = latest.endpoint_id
      AND dr.mount_point = latest.mount_point
      AND dr.reported_at = latest.max_reported
    ORDER BY dr.mount_point ASC
  `).all(endpointId) as DiskReport[];
}

export interface CriticalDiskReport {
  endpoint_id: number;
  endpoint_name: string;
  mount_point: string;
  total_gb: number;
  used_gb: number;
  percent_used: number;
  reported_at: string;
}

export function getCriticalDiskReports(db: Database.Database): CriticalDiskReport[] {
  return db.prepare(`
    SELECT dr.endpoint_id, e.name as endpoint_name, dr.mount_point,
           dr.total_gb, dr.used_gb, dr.percent_used, dr.reported_at
    FROM disk_reports dr
    INNER JOIN (
      SELECT endpoint_id, mount_point, MAX(reported_at) as max_reported
      FROM disk_reports
      GROUP BY endpoint_id, mount_point
    ) latest ON dr.endpoint_id = latest.endpoint_id
      AND dr.mount_point = latest.mount_point
      AND dr.reported_at = latest.max_reported
    INNER JOIN endpoints e ON dr.endpoint_id = e.id
    WHERE dr.percent_used >= 85
    ORDER BY dr.percent_used DESC
  `).all() as CriticalDiskReport[];
}

export function deleteOldDiskReports(db: Database.Database): number {
  const result = db.prepare(
    "DELETE FROM disk_reports WHERE reported_at < datetime('now', '-30 days')"
  ).run();
  return result.changes;
}
