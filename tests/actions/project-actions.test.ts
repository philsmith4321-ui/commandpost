import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initDb } from '@/lib/db';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-projects.db');

describe('project queries', () => {
  let db: Database.Database;
  let clientId: number;

  beforeEach(async () => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    db = initDb(TEST_DB_PATH);
    const { createClient } = await import('@/lib/queries/client-queries');
    clientId = createClient(db, { name: 'Test Client', status: 'active' });
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('creates and retrieves a project', async () => {
    const { createProject, getProjectById } = await import('@/lib/queries/project-queries');
    const id = createProject(db, {
      client_id: clientId,
      name: 'AI Writing Tool',
      status: 'active',
      server_ip: '165.227.185.182',
      repo_url: 'https://github.com/test/repo',
    });
    const project = getProjectById(db, id);
    expect(project).toBeTruthy();
    expect(project!.name).toBe('AI Writing Tool');
    expect(project!.server_ip).toBe('165.227.185.182');
  });

  it('creates and retrieves deliverables', async () => {
    const { createProject, createDeliverable, listDeliverables, updateDeliverableStatus } = await import('@/lib/queries/project-queries');
    const projectId = createProject(db, { client_id: clientId, name: 'Test', status: 'active' });
    createDeliverable(db, { project_id: projectId, title: 'Design mockup', due_date: '2026-06-01' });
    createDeliverable(db, { project_id: projectId, title: 'Backend API', due_date: '2026-06-15' });
    const deliverables = listDeliverables(db, projectId);
    expect(deliverables).toHaveLength(2);
    expect(deliverables[0].status).toBe('not_started');
    updateDeliverableStatus(db, deliverables[0].id, 'delivered');
    const updated = listDeliverables(db, projectId);
    expect(updated[0].status).toBe('delivered');
    expect(updated[0].completed_at).toBeTruthy();
  });
});
