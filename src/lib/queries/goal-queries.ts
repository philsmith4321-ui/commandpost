import type Database from 'better-sqlite3';

export interface Goal {
  id: number;
  title: string;
  target_value: number;
  current_value: number;
  unit: string;
  period: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  period_start: string;
  period_end: string;
  is_active: number;
  created_at: string;
}

export function listGoals(db: Database.Database): Goal[] {
  return db.prepare('SELECT * FROM goals WHERE is_active = 1 ORDER BY period_end ASC').all() as Goal[];
}

export function listAllGoals(db: Database.Database): Goal[] {
  return db.prepare('SELECT * FROM goals ORDER BY created_at DESC').all() as Goal[];
}

export function createGoal(db: Database.Database, data: {
  title: string;
  target_value: number;
  unit: string;
  period: string;
  period_start: string;
  period_end: string;
}): number {
  const result = db.prepare(`
    INSERT INTO goals (title, target_value, current_value, unit, period, period_start, period_end)
    VALUES (?, ?, 0, ?, ?, ?, ?)
  `).run(data.title, data.target_value, data.unit, data.period, data.period_start, data.period_end);
  return Number(result.lastInsertRowid);
}

export function updateGoalProgress(db: Database.Database, id: number, currentValue: number): void {
  db.prepare('UPDATE goals SET current_value = ? WHERE id = ?').run(currentValue, id);
}

export function deleteGoal(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM goals WHERE id = ?').run(id);
}

export function getAutoCalculatedGoals(db: Database.Database): Goal[] {
  const goals = listGoals(db);
  
  for (const goal of goals) {
    let value = 0;
    if (goal.unit === 'revenue') {
      value = (db.prepare(`
        SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices
        WHERE status = 'paid' AND paid_at >= ? AND paid_at <= ?
      `).get(goal.period_start, goal.period_end) as any).total;
    } else if (goal.unit === 'clients') {
      value = (db.prepare(`
        SELECT COUNT(*) as count FROM clients
        WHERE status = 'active' AND deleted_at IS NULL AND created_at >= ?
      `).get(goal.period_start) as any).count;
    } else if (goal.unit === 'hours') {
      const mins = (db.prepare(`
        SELECT COALESCE(SUM(duration_minutes), 0) as total FROM time_entries
        WHERE entry_date >= ? AND entry_date <= ?
      `).get(goal.period_start, goal.period_end) as any).total;
      value = Math.round(mins / 60);
    } else if (goal.unit === 'deals') {
      value = (db.prepare(`
        SELECT COUNT(*) as count FROM leads
        WHERE stage = 'won' AND updated_at >= ?
      `).get(goal.period_start) as any).count;
    }
    
    if (value !== goal.current_value) {
      updateGoalProgress(db, goal.id, value);
      goal.current_value = value;
    }
  }
  
  return goals;
}
