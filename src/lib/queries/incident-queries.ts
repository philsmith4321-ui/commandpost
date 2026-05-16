import type Database from 'better-sqlite3';
import type { Incident } from '@/lib/types';

export function createIncident(db: Database.Database, endpointId: number): number {
  const result = db.prepare(
    `INSERT INTO incidents (endpoint_id) VALUES (?)`
  ).run(endpointId);
  return Number(result.lastInsertRowid);
}

export function getOpenIncident(db: Database.Database, endpointId: number): Incident | undefined {
  return db.prepare(
    'SELECT * FROM incidents WHERE endpoint_id = ? AND resolved_at IS NULL LIMIT 1'
  ).get(endpointId) as Incident | undefined;
}

export function getIncidentById(db: Database.Database, id: number): Incident | undefined {
  return db.prepare('SELECT * FROM incidents WHERE id = ?').get(id) as Incident | undefined;
}

export function resolveIncident(db: Database.Database, id: number): void {
  db.prepare(`
    UPDATE incidents
    SET resolved_at = datetime('now'),
        duration_seconds = CAST((julianday('now') - julianday(started_at)) * 86400 AS INTEGER)
    WHERE id = ?
  `).run(id);
}

export function listIncidents(db: Database.Database, endpointId: number): Incident[] {
  return db.prepare(
    'SELECT * FROM incidents WHERE endpoint_id = ? ORDER BY started_at DESC'
  ).all(endpointId) as Incident[];
}

export function getTotalIncidentCount(db: Database.Database, endpointId: number): number {
  return (db.prepare(
    'SELECT COUNT(*) as count FROM incidents WHERE endpoint_id = ?'
  ).get(endpointId) as { count: number }).count;
}

export interface OpenIncidentWithEndpoint extends Incident {
  endpoint_name: string;
}

export function listOpenIncidents(db: Database.Database): OpenIncidentWithEndpoint[] {
  return db.prepare(`
    SELECT i.*, e.name as endpoint_name
    FROM incidents i JOIN endpoints e ON i.endpoint_id = e.id
    WHERE i.resolved_at IS NULL
    ORDER BY i.started_at ASC
  `).all() as OpenIncidentWithEndpoint[];
}
