import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initDb } from '@/lib/db';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-alerts.db');

describe('alert queries', () => {
  let db: Database.Database;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    db = initDb(TEST_DB_PATH);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('records an alert', async () => {
    const { recordAlert, listRecentAlerts } = await import('@/lib/queries/alert-queries');
    recordAlert(db, { alert_type: 'server_down', reference_id: 42, message: 'ALERT: Test is down' });
    const alerts = listRecentAlerts(db, 10);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].alert_type).toBe('server_down');
    expect(alerts[0].reference_id).toBe(42);
    expect(alerts[0].message).toBe('ALERT: Test is down');
  });

  it('detects duplicate alerts by type and reference_id', async () => {
    const { recordAlert, hasAlertBeenSent } = await import('@/lib/queries/alert-queries');
    expect(hasAlertBeenSent(db, 'server_down', 42)).toBe(false);
    recordAlert(db, { alert_type: 'server_down', reference_id: 42, message: 'ALERT: Test is down' });
    expect(hasAlertBeenSent(db, 'server_down', 42)).toBe(true);
    expect(hasAlertBeenSent(db, 'server_down', 99)).toBe(false);
    expect(hasAlertBeenSent(db, 'server_recovered', 42)).toBe(false);
  });

  it('records alerts without reference_id', async () => {
    const { recordAlert, listRecentAlerts } = await import('@/lib/queries/alert-queries');
    recordAlert(db, { alert_type: 'morning_briefing', reference_id: null, message: 'Good morning.' });
    const alerts = listRecentAlerts(db, 10);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].reference_id).toBeNull();
  });

  it('lists recent alerts in descending order', async () => {
    const { recordAlert, listRecentAlerts } = await import('@/lib/queries/alert-queries');
    recordAlert(db, { alert_type: 'server_down', reference_id: 1, message: 'First' });
    recordAlert(db, { alert_type: 'server_recovered', reference_id: 1, message: 'Second' });
    const alerts = listRecentAlerts(db, 10);
    expect(alerts).toHaveLength(2);
    expect(alerts[0].message).toBe('Second'); // newest first
  });
});
