import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initDb } from '@/lib/db';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-disk-reports.db');

describe('disk report queries', () => {
  let db: Database.Database;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    db = initDb(TEST_DB_PATH);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('records and retrieves disk reports', async () => {
    const { recordDiskReport, getLatestDiskReports } = await import('@/lib/queries/disk-report-queries');

    const epId = Number(db.prepare("INSERT INTO endpoints (name, url, check_interval_seconds, slow_threshold_ms, is_active) VALUES (?, ?, ?, ?, ?)").run('test-server', 'https://test.com', 300, 5000, 1).lastInsertRowid);
    recordDiskReport(db, { endpoint_id: epId, mount_point: '/', total_gb: 50, used_gb: 42, percent_used: 84.0 });
    recordDiskReport(db, { endpoint_id: epId, mount_point: '/data', total_gb: 200, used_gb: 185, percent_used: 92.5 });

    const reports = getLatestDiskReports(db, epId);
    expect(reports).toHaveLength(2);
    expect(reports.find(r => r.mount_point === '/')!.percent_used).toBe(84.0);
    expect(reports.find(r => r.mount_point === '/data')!.percent_used).toBe(92.5);
  });

  it('returns only the latest report per mount point', async () => {
    const { recordDiskReport, getLatestDiskReports } = await import('@/lib/queries/disk-report-queries');

    const epId = Number(db.prepare("INSERT INTO endpoints (name, url, check_interval_seconds, slow_threshold_ms, is_active) VALUES (?, ?, ?, ?, ?)").run('test-server', 'https://test.com', 300, 5000, 1).lastInsertRowid);

    // Old report
    db.prepare("INSERT INTO disk_reports (endpoint_id, mount_point, total_gb, used_gb, percent_used, reported_at) VALUES (?, ?, ?, ?, ?, datetime('now', '-1 hour'))").run(epId, '/', 50, 30, 60.0);
    // New report
    recordDiskReport(db, { endpoint_id: epId, mount_point: '/', total_gb: 50, used_gb: 42, percent_used: 84.0 });

    const reports = getLatestDiskReports(db, epId);
    expect(reports).toHaveLength(1);
    expect(reports[0].percent_used).toBe(84.0);
  });

  it('deletes old disk reports', async () => {
    const { deleteOldDiskReports } = await import('@/lib/queries/disk-report-queries');

    const epId = Number(db.prepare("INSERT INTO endpoints (name, url, check_interval_seconds, slow_threshold_ms, is_active) VALUES (?, ?, ?, ?, ?)").run('test-server', 'https://test.com', 300, 5000, 1).lastInsertRowid);

    // Insert old report (31 days ago)
    db.prepare("INSERT INTO disk_reports (endpoint_id, mount_point, total_gb, used_gb, percent_used, reported_at) VALUES (?, ?, ?, ?, ?, datetime('now', '-31 days'))").run(epId, '/', 50, 42, 84.0);
    // Insert recent report
    db.prepare("INSERT INTO disk_reports (endpoint_id, mount_point, total_gb, used_gb, percent_used) VALUES (?, ?, ?, ?, ?)").run(epId, '/', 50, 42, 84.0);

    const deleted = deleteOldDiskReports(db);
    expect(deleted).toBe(1);

    const remaining = db.prepare('SELECT COUNT(*) as count FROM disk_reports').get() as any;
    expect(remaining.count).toBe(1);
  });

  it('gets all critical disk reports across endpoints', async () => {
    const { recordDiskReport, getCriticalDiskReports } = await import('@/lib/queries/disk-report-queries');

    const ep1 = Number(db.prepare("INSERT INTO endpoints (name, url, check_interval_seconds, slow_threshold_ms, is_active) VALUES (?, ?, ?, ?, ?)").run('server-1', 'https://s1.com', 300, 5000, 1).lastInsertRowid);
    const ep2 = Number(db.prepare("INSERT INTO endpoints (name, url, check_interval_seconds, slow_threshold_ms, is_active) VALUES (?, ?, ?, ?, ?)").run('server-2', 'https://s2.com', 300, 5000, 1).lastInsertRowid);

    recordDiskReport(db, { endpoint_id: ep1, mount_point: '/', total_gb: 50, used_gb: 45, percent_used: 90.0 });
    recordDiskReport(db, { endpoint_id: ep2, mount_point: '/', total_gb: 100, used_gb: 50, percent_used: 50.0 });

    const critical = getCriticalDiskReports(db);
    expect(critical).toHaveLength(1);
    expect(critical[0].endpoint_name).toBe('server-1');
    expect(critical[0].percent_used).toBe(90.0);
  });
});
