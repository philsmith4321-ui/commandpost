import type Database from 'better-sqlite3';
import type { AlertSent, AlertType } from '@/lib/types';

interface RecordAlertInput {
  alert_type: AlertType;
  reference_id: number | null;
  message: string;
}

export function recordAlert(db: Database.Database, input: RecordAlertInput): number {
  const result = db.prepare(
    `INSERT INTO alerts_sent (alert_type, reference_id, message) VALUES (?, ?, ?)`
  ).run(input.alert_type, input.reference_id, input.message);
  return Number(result.lastInsertRowid);
}

export function hasAlertBeenSent(db: Database.Database, alertType: AlertType, referenceId: number): boolean {
  const row = db.prepare(
    'SELECT id FROM alerts_sent WHERE alert_type = ? AND reference_id = ? LIMIT 1'
  ).get(alertType, referenceId);
  return !!row;
}

export function hasAlertBeenSentToday(db: Database.Database, alertType: AlertType, referenceId: number): boolean {
  const row = db.prepare(
    "SELECT id FROM alerts_sent WHERE alert_type = ? AND reference_id = ? AND sent_at >= date('now') LIMIT 1"
  ).get(alertType, referenceId);
  return !!row;
}

export function hasAlertBeenSentInLastDays(db: Database.Database, alertType: AlertType, referenceId: number, days: number): boolean {
  const row = db.prepare(
    "SELECT id FROM alerts_sent WHERE alert_type = ? AND reference_id = ? AND sent_at >= date('now', '-' || ? || ' days') LIMIT 1"
  ).get(alertType, referenceId, days);
  return !!row;
}

export function listRecentAlerts(db: Database.Database, limit: number): AlertSent[] {
  return db.prepare(
    'SELECT * FROM alerts_sent ORDER BY sent_at DESC, id DESC LIMIT ?'
  ).all(limit) as AlertSent[];
}
