import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initDb } from '@/lib/db';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-expenses.db');

describe('expense queries', () => {
  let db: Database.Database;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    db = initDb(TEST_DB_PATH);
    db.prepare("INSERT INTO clients (name, status) VALUES (?, ?)").run('Test Client', 'active');
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('creates and retrieves an expense', async () => {
    const { createExpense, getExpenseById } = await import('@/lib/queries/expense-queries');
    const id = createExpense(db, {
      category: 'servers',
      description: 'DigitalOcean droplet',
      amount: 24,
      expense_date: '2026-05-01',
      client_id: 1,
    });
    expect(id).toBeGreaterThan(0);
    const expense = getExpenseById(db, id);
    expect(expense!.description).toBe('DigitalOcean droplet');
    expect(expense!.client_name).toBe('Test Client');
  });

  it('lists expenses with optional filters', async () => {
    const { createExpense, listExpenses } = await import('@/lib/queries/expense-queries');
    createExpense(db, { category: 'servers', description: 'A', amount: 10, expense_date: '2026-05-01' });
    createExpense(db, { category: 'software', description: 'B', amount: 20, expense_date: '2026-05-15' });
    createExpense(db, { category: 'servers', description: 'C', amount: 30, expense_date: '2026-04-01' });

    const all = listExpenses(db);
    expect(all).toHaveLength(3);

    const serversOnly = listExpenses(db, { category: 'servers' });
    expect(serversOnly).toHaveLength(2);

    const mayOnly = listExpenses(db, { month: '2026-05' });
    expect(mayOnly).toHaveLength(2);
  });

  it('updates an expense', async () => {
    const { createExpense, updateExpense, getExpenseById } = await import('@/lib/queries/expense-queries');
    const id = createExpense(db, { category: 'servers', description: 'Old', amount: 10, expense_date: '2026-05-01' });
    updateExpense(db, id, { description: 'New', amount: 20 });
    const expense = getExpenseById(db, id);
    expect(expense!.description).toBe('New');
    expect(expense!.amount).toBe(20);
  });

  it('deletes an expense', async () => {
    const { createExpense, deleteExpense, getExpenseById } = await import('@/lib/queries/expense-queries');
    const id = createExpense(db, { category: 'other', description: 'X', amount: 5, expense_date: '2026-05-01' });
    deleteExpense(db, id);
    expect(getExpenseById(db, id)).toBeUndefined();
  });

  it('gets monthly total', async () => {
    const { createExpense, getExpenseMonthlyTotal } = await import('@/lib/queries/expense-queries');
    createExpense(db, { category: 'servers', description: 'A', amount: 10, expense_date: '2026-05-01' });
    createExpense(db, { category: 'software', description: 'B', amount: 20, expense_date: '2026-05-15' });
    const total = getExpenseMonthlyTotal(db, '2026-05');
    expect(total).toBe(30);
  });
});
