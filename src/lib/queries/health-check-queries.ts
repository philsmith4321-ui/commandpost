import type Database from 'better-sqlite3';
import type { HealthCheck } from '@/lib/types';

interface RecordHealthCheckInput {
  endpoint_id: number;
  status_code: number | null;
  response_time_ms: number;
  is_healthy: number;
}

export function recordHealthCheck(db: Database.Database, input: RecordHealthCheckInput): number {
  const result = db.prepare(
    `INSERT INTO health_checks (endpoint_id, status_code, response_time_ms, is_healthy) VALUES (?, ?, ?, ?)`
  ).run(input.endpoint_id, input.status_code, input.response_time_ms, input.is_healthy);
  return Number(result.lastInsertRowid);
}

export function getLastHealthCheck(db: Database.Database, endpointId: number): HealthCheck | undefined {
  return db.prepare(
    'SELECT * FROM health_checks WHERE endpoint_id = ? ORDER BY checked_at DESC, id DESC LIMIT 1'
  ).get(endpointId) as HealthCheck | undefined;
}

export function getLastNHealthChecks(db: Database.Database, endpointId: number, n: number): HealthCheck[] {
  return db.prepare(
    'SELECT * FROM health_checks WHERE endpoint_id = ? ORDER BY checked_at DESC, id DESC LIMIT ?'
  ).all(endpointId, n) as HealthCheck[];
}

export function getUptimePercent(db: Database.Database, endpointId: number): number {
  const row = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN is_healthy = 1 THEN 1 ELSE 0 END) as healthy
    FROM health_checks
    WHERE endpoint_id = ? AND checked_at >= datetime('now', '-30 days')
  `).get(endpointId) as { total: number; healthy: number };
  if (row.total === 0) return 100;
  return (row.healthy / row.total) * 100;
}

export function getAvgResponseTime24h(db: Database.Database, endpointId: number): number {
  const row = db.prepare(`
    SELECT COALESCE(CAST(AVG(response_time_ms) AS INTEGER), 0) as avg_ms
    FROM health_checks
    WHERE endpoint_id = ? AND checked_at >= datetime('now', '-1 day')
  `).get(endpointId) as { avg_ms: number };
  return row.avg_ms;
}

export function getHealthChecks24h(db: Database.Database, endpointId: number): HealthCheck[] {
  return db.prepare(
    `SELECT * FROM health_checks WHERE endpoint_id = ? AND checked_at >= datetime('now', '-1 day') ORDER BY checked_at ASC`
  ).all(endpointId) as HealthCheck[];
}

export function deleteOldHealthChecks(db: Database.Database): number {
  const result = db.prepare(
    `DELETE FROM health_checks WHERE checked_at < datetime('now', '-30 days')`
  ).run();
  return result.changes;
}
