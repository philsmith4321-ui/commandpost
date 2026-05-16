import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initDb } from '@/lib/db';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-endpoints.db');

describe('endpoint queries', () => {
  let db: Database.Database;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    db = initDb(TEST_DB_PATH);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('creates and retrieves an endpoint', async () => {
    const { createEndpoint, getEndpointById } = await import('@/lib/queries/endpoint-queries');
    const id = createEndpoint(db, { name: 'Test App', url: 'http://localhost:3000/health', check_interval_seconds: 60, slow_threshold_ms: 3000, is_active: 1 });
    const ep = getEndpointById(db, id);
    expect(ep).toBeTruthy();
    expect(ep!.name).toBe('Test App');
    expect(ep!.url).toBe('http://localhost:3000/health');
    expect(ep!.check_interval_seconds).toBe(60);
  });

  it('lists all endpoints', async () => {
    const { createEndpoint, listEndpoints } = await import('@/lib/queries/endpoint-queries');
    createEndpoint(db, { name: 'App A', url: 'http://a.com', check_interval_seconds: 300, slow_threshold_ms: 5000, is_active: 1 });
    createEndpoint(db, { name: 'App B', url: 'http://b.com', check_interval_seconds: 300, slow_threshold_ms: 5000, is_active: 1 });
    const all = listEndpoints(db);
    expect(all).toHaveLength(2);
  });

  it('updates an endpoint', async () => {
    const { createEndpoint, updateEndpoint, getEndpointById } = await import('@/lib/queries/endpoint-queries');
    const id = createEndpoint(db, { name: 'Old Name', url: 'http://old.com', check_interval_seconds: 300, slow_threshold_ms: 5000, is_active: 1 });
    updateEndpoint(db, id, { name: 'New Name', url: 'http://new.com', check_interval_seconds: 60, slow_threshold_ms: 2000, is_active: 0 });
    const ep = getEndpointById(db, id);
    expect(ep!.name).toBe('New Name');
    expect(ep!.is_active).toBe(0);
  });

  it('deletes an endpoint', async () => {
    const { createEndpoint, deleteEndpoint, getEndpointById } = await import('@/lib/queries/endpoint-queries');
    const id = createEndpoint(db, { name: 'Doomed', url: 'http://doomed.com', check_interval_seconds: 300, slow_threshold_ms: 5000, is_active: 1 });
    deleteEndpoint(db, id);
    expect(getEndpointById(db, id)).toBeUndefined();
  });
});
