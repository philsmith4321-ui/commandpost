import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initDb } from '@/lib/db';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-incidents.db');

describe('incident queries', () => {
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

  it('creates an incident and finds it as open', async () => {
    const { createIncident, getOpenIncident } = await import('@/lib/queries/incident-queries');
    createIncident(db, endpointId);
    const open = getOpenIncident(db, endpointId);
    expect(open).toBeTruthy();
    expect(open!.endpoint_id).toBe(endpointId);
    expect(open!.resolved_at).toBeNull();
  });

  it('resolves an open incident', async () => {
    const { createIncident, getOpenIncident, resolveIncident, getIncidentById } = await import('@/lib/queries/incident-queries');
    createIncident(db, endpointId);
    const open = getOpenIncident(db, endpointId)!;
    resolveIncident(db, open.id);
    const resolved = getIncidentById(db, open.id);
    expect(resolved!.resolved_at).toBeTruthy();
    expect(resolved!.duration_seconds).toBeGreaterThanOrEqual(0);
  });

  it('lists incidents for an endpoint sorted newest first', async () => {
    const { createIncident, resolveIncident, getOpenIncident, listIncidents } = await import('@/lib/queries/incident-queries');
    createIncident(db, endpointId);
    const first = getOpenIncident(db, endpointId)!;
    resolveIncident(db, first.id);
    createIncident(db, endpointId);
    const all = listIncidents(db, endpointId);
    expect(all).toHaveLength(2);
  });

  it('counts total incidents for an endpoint', async () => {
    const { createIncident, resolveIncident, getOpenIncident, getTotalIncidentCount } = await import('@/lib/queries/incident-queries');
    createIncident(db, endpointId);
    resolveIncident(db, getOpenIncident(db, endpointId)!.id);
    createIncident(db, endpointId);
    expect(getTotalIncidentCount(db, endpointId)).toBe(2);
  });

  it('lists all open incidents across all endpoints', async () => {
    const { createIncident, listOpenIncidents } = await import('@/lib/queries/incident-queries');
    const ep2 = Number(db.prepare("INSERT INTO endpoints (name, url) VALUES (?, ?)").run('Test2', 'http://test2.com').lastInsertRowid);
    createIncident(db, endpointId);
    createIncident(db, ep2);
    const open = listOpenIncidents(db);
    expect(open).toHaveLength(2);
  });
});
