import type Database from 'better-sqlite3';
import type { Expense, ExpenseCategory } from '@/lib/types';

interface CreateExpenseInput {
  client_id?: number | null;
  category: ExpenseCategory;
  description: string;
  amount: number;
  expense_date: string;
}

interface UpdateExpenseInput {
  client_id?: number | null;
  category?: ExpenseCategory;
  description?: string;
  amount?: number;
  expense_date?: string;
}

interface ListExpensesFilter {
  category?: ExpenseCategory;
  month?: string; // 'YYYY-MM'
}

export interface ExpenseWithClient extends Expense {
  client_name: string | null;
}

export function createExpense(db: Database.Database, input: CreateExpenseInput): number {
  const result = db.prepare(`
    INSERT INTO expenses (client_id, category, description, amount, expense_date)
    VALUES (@client_id, @category, @description, @amount, @expense_date)
  `).run({
    client_id: input.client_id ?? null,
    category: input.category,
    description: input.description,
    amount: input.amount,
    expense_date: input.expense_date,
  });
  return Number(result.lastInsertRowid);
}

export function getExpenseById(db: Database.Database, id: number): ExpenseWithClient | undefined {
  return db.prepare(`
    SELECT e.*, c.name as client_name
    FROM expenses e LEFT JOIN clients c ON e.client_id = c.id
    WHERE e.id = ?
  `).get(id) as ExpenseWithClient | undefined;
}

export function listExpenses(db: Database.Database, filter?: ListExpensesFilter): ExpenseWithClient[] {
  let sql = 'SELECT e.*, c.name as client_name FROM expenses e LEFT JOIN clients c ON e.client_id = c.id';
  const conditions: string[] = [];
  const params: any[] = [];

  if (filter?.category) {
    conditions.push('e.category = ?');
    params.push(filter.category);
  }
  if (filter?.month) {
    conditions.push("strftime('%Y-%m', e.expense_date) = ?");
    params.push(filter.month);
  }

  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY e.expense_date DESC';

  return db.prepare(sql).all(...params) as ExpenseWithClient[];
}

export function updateExpense(db: Database.Database, id: number, input: UpdateExpenseInput): void {
  const fields: string[] = [];
  const params: any = { id };

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      fields.push(`${key} = @${key}`);
      params[key] = value;
    }
  }

  if (fields.length === 0) return;
  db.prepare(`UPDATE expenses SET ${fields.join(', ')} WHERE id = @id`).run(params);
}

export function deleteExpense(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
}

export function getExpenseMonthlyTotal(db: Database.Database, month: string): number {
  return (db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE strftime('%Y-%m', expense_date) = ?").get(month) as any).total;
}
