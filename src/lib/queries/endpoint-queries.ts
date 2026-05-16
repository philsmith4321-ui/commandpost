import type Database from 'better-sqlite3';
import type { Endpoint } from '@/lib/types';

interface CreateEndpointInput {
  name: string;
  url: string;
  check_interval_seconds: number;
  slow_threshold_ms: number;
  is_active: number;
}

export function createEndpoint(db: Database.Database, input: CreateEndpointInput): number {
  const result = db.prepare(
    `INSERT INTO endpoints (name, url, check_interval_seconds, slow_threshold_ms, is_active) VALUES (?, ?, ?, ?, ?)`
  ).run(input.name, input.url, input.check_interval_seconds, input.slow_threshold_ms, input.is_active);
  return Number(result.lastInsertRowid);
}

export function getEndpointById(db: Database.Database, id: number): Endpoint | undefined {
  return db.prepare('SELECT * FROM endpoints WHERE id = ?').get(id) as Endpoint | undefined;
}

export function listEndpoints(db: Database.Database): Endpoint[] {
  return db.prepare('SELECT * FROM endpoints ORDER BY name ASC').all() as Endpoint[];
}

export function listActiveEndpoints(db: Database.Database): Endpoint[] {
  return db.prepare('SELECT * FROM endpoints WHERE is_active = 1 ORDER BY name ASC').all() as Endpoint[];
}

export function updateEndpoint(db: Database.Database, id: number, input: CreateEndpointInput): void {
  db.prepare(
    `UPDATE endpoints SET name = ?, url = ?, check_interval_seconds = ?, slow_threshold_ms = ?, is_active = ? WHERE id = ?`
  ).run(input.name, input.url, input.check_interval_seconds, input.slow_threshold_ms, input.is_active, id);
}

export function deleteEndpoint(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM endpoints WHERE id = ?').run(id);
}
