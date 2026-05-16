import type Database from 'better-sqlite3';

export interface MetricSnapshot {
  id: number;
  metric_name: string;
  metric_value: number;
  snapshot_date: string;
}

export function saveSnapshot(db: Database.Database, metricName: string, value: number, date?: string): void {
  const d = date || new Date().toISOString().split('T')[0];
  // Upsert: delete existing for same date+metric, then insert
  db.prepare('DELETE FROM metric_snapshots WHERE metric_name = ? AND snapshot_date = ?').run(metricName, d);
  db.prepare('INSERT INTO metric_snapshots (metric_name, metric_value, snapshot_date) VALUES (?, ?, ?)').run(metricName, value, d);
}

export function getSnapshotHistory(db: Database.Database, metricName: string, limit = 30): MetricSnapshot[] {
  return db.prepare(
    'SELECT * FROM metric_snapshots WHERE metric_name = ? ORDER BY snapshot_date DESC LIMIT ?'
  ).all(metricName, limit) as MetricSnapshot[];
}

export function getLatestSnapshots(db: Database.Database): Record<string, { value: number; date: string }> {
  const rows = db.prepare(`
    SELECT metric_name, metric_value, snapshot_date
    FROM metric_snapshots
    WHERE (metric_name, snapshot_date) IN (
      SELECT metric_name, MAX(snapshot_date) FROM metric_snapshots GROUP BY metric_name
    )
  `).all() as MetricSnapshot[];

  const result: Record<string, { value: number; date: string }> = {};
  for (const row of rows) {
    result[row.metric_name] = { value: row.metric_value, date: row.snapshot_date };
  }
  return result;
}

export function getAllMetricNames(db: Database.Database): string[] {
  return (db.prepare('SELECT DISTINCT metric_name FROM metric_snapshots ORDER BY metric_name').all() as any[]).map(r => r.metric_name);
}
