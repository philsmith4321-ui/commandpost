import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initDb } from '@/lib/db';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-healthchecks.db');

describe('health check queries', () => {
  let db: Database.Database;
  let endpointId: number;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    db = initDb(TEST_DB_PATH);
    endpointId = Number(db.prepare("INSERT INTO endpoints (name, url) VALUES (?, ?)").run('Test', 'http://test.com').lastInsertRowid);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('records a health check', async () => {
    const { recordHealthCheck, getLastHealthCheck } = await import('@/lib/queries/health-check-queries');
    recordHealthCheck(db, { endpoint_id: endpointId, status_code: 200, response_time_ms: 150, is_healthy: 1 });
    const last = getLastHealthCheck(db, endpointId);
    expect(last).toBeTruthy();
    expect(last!.status_code).toBe(200);
    expect(last!.is_healthy).toBe(1);
  });

  it('gets last N health checks for an endpoint', async () => {
    const { recordHealthCheck, getLastNHealthChecks } = await import('@/lib/queries/health-check-queries');
    recordHealthCheck(db, { endpoint_id: endpointId, status_code: 200, response_time_ms: 100, is_healthy: 1 });
    recordHealthCheck(db, { endpoint_id: endpointId, status_code: 500, response_time_ms: 200, is_healthy: 0 });
    recordHealthCheck(db, { endpoint_id: endpointId, status_code: null, response_time_ms: 10000, is_healthy: 0 });
    const last2 = getLastNHealthChecks(db, endpointId, 2);
    expect(last2).toHaveLength(2);
    expect(last2[0].is_healthy).toBe(0); // newest first
    expect(last2[1].is_healthy).toBe(0);
  });

  it('computes uptime percentage over 30 days', async () => {
    const { recordHealthCheck, getUptimePercent } = await import('@/lib/queries/health-check-queries');
    for (let i = 0; i < 8; i++) recordHealthCheck(db, { endpoint_id: endpointId, status_code: 200, response_time_ms: 100, is_healthy: 1 });
    for (let i = 0; i < 2; i++) recordHealthCheck(db, { endpoint_id: endpointId, status_code: 500, response_time_ms: 100, is_healthy: 0 });
    const uptime = getUptimePercent(db, endpointId);
    expect(uptime).toBeCloseTo(80, 0);
  });

  it('computes average response time over 24 hours', async () => {
    const { recordHealthCheck, getAvgResponseTime24h } = await import('@/lib/queries/health-check-queries');
    recordHealthCheck(db, { endpoint_id: endpointId, status_code: 200, response_time_ms: 100, is_healthy: 1 });
    recordHealthCheck(db, { endpoint_id: endpointId, status_code: 200, response_time_ms: 300, is_healthy: 1 });
    const avg = getAvgResponseTime24h(db, endpointId);
    expect(avg).toBe(200);
  });

  it('gets health checks for last 24 hours for chart', async () => {
    const { recordHealthCheck, getHealthChecks24h } = await import('@/lib/queries/health-check-queries');
    recordHealthCheck(db, { endpoint_id: endpointId, status_code: 200, response_time_ms: 150, is_healthy: 1 });
    const checks = getHealthChecks24h(db, endpointId);
    expect(checks).toHaveLength(1);
    expect(checks[0].response_time_ms).toBe(150);
  });

  it('deletes old health checks', async () => {
    const { recordHealthCheck, deleteOldHealthChecks } = await import('@/lib/queries/health-check-queries');
    db.prepare("INSERT INTO health_checks (endpoint_id, status_code, response_time_ms, is_healthy, checked_at) VALUES (?, ?, ?, ?, datetime('now', '-31 days'))").run(endpointId, 200, 100, 1);
    recordHealthCheck(db, { endpoint_id: endpointId, status_code: 200, response_time_ms: 100, is_healthy: 1 });
    const deleted = deleteOldHealthChecks(db);
    expect(deleted).toBe(1);
  });
});
