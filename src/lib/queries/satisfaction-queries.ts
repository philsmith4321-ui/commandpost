import type Database from 'better-sqlite3';

export interface SatisfactionScore {
  id: number;
  client_id: number;
  client_name?: string;
  score: number;
  notes: string | null;
  scored_at: string;
}

export function addScore(db: Database.Database, clientId: number, score: number, notes?: string): number {
  const result = db.prepare(
    "INSERT INTO satisfaction_scores (client_id, score, notes) VALUES (?, ?, ?)"
  ).run(clientId, score, notes || null);
  return Number(result.lastInsertRowid);
}

export function getClientScores(db: Database.Database, clientId: number): SatisfactionScore[] {
  return db.prepare(
    "SELECT * FROM satisfaction_scores WHERE client_id = ? ORDER BY scored_at DESC"
  ).all(clientId) as SatisfactionScore[];
}

export function getAllScores(db: Database.Database): (SatisfactionScore & { client_name: string })[] {
  return db.prepare(
    "SELECT s.*, c.name as client_name FROM satisfaction_scores s JOIN clients c ON c.id = s.client_id ORDER BY s.scored_at DESC"
  ).all() as (SatisfactionScore & { client_name: string })[];
}

export function getNpsStats(db: Database.Database): { promoters: number; passives: number; detractors: number; nps: number; total: number } {
  // Use latest score per client
  const latest = db.prepare(`
    SELECT s.score FROM satisfaction_scores s
    INNER JOIN (SELECT client_id, MAX(scored_at) as max_date FROM satisfaction_scores GROUP BY client_id) latest
    ON s.client_id = latest.client_id AND s.scored_at = latest.max_date
  `).all() as { score: number }[];

  const total = latest.length;
  if (total === 0) return { promoters: 0, passives: 0, detractors: 0, nps: 0, total: 0 };

  const promoters = latest.filter(s => s.score >= 9).length;
  const passives = latest.filter(s => s.score >= 7 && s.score <= 8).length;
  const detractors = latest.filter(s => s.score <= 6).length;
  const nps = Math.round(((promoters - detractors) / total) * 100);

  return { promoters, passives, detractors, nps, total };
}
