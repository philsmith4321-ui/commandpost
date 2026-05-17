'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import {
  createExpense,
  updateExpense,
  deleteExpense,
} from '@/lib/queries/expense-queries';
import type { ExpenseCategory } from '@/lib/types';

export async function createExpenseAction(formData: FormData) {
  const db = getDb();
  createExpense(db, {
    client_id: formData.get('client_id') ? Number(formData.get('client_id')) : null,
    category: (formData.get('category') as ExpenseCategory) || 'other',
    description: formData.get('description') as string,
    amount: Number(formData.get('amount')),
    expense_date: formData.get('expense_date') as string,
  });

  revalidatePath('/finances');
  revalidatePath('/finances/expenses');
}

export async function updateExpenseAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));

  updateExpense(db, id, {
    client_id: formData.get('client_id') ? Number(formData.get('client_id')) : null,
    category: (formData.get('category') as ExpenseCategory) || 'other',
    description: formData.get('description') as string,
    amount: Number(formData.get('amount')),
    expense_date: formData.get('expense_date') as string,
  });

  revalidatePath('/finances');
}

export async function deleteExpenseAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  deleteExpense(db, id);
  revalidatePath('/finances');
  revalidatePath('/finances/expenses');
}

export async function saveBudgetAction(formData: FormData) {
  const db = getDb();
  const categories = ['servers', 'software', 'contractor', 'marketing', 'other'];
  const stmt = db.prepare('INSERT OR REPLACE INTO expense_budgets (category, monthly_limit) VALUES (?, ?)');
  const delStmt = db.prepare('DELETE FROM expense_budgets WHERE category = ?');

  for (const cat of categories) {
    const val = formData.get(`budget_${cat}`);
    if (val && Number(val) > 0) {
      stmt.run(cat, Number(val));
    } else {
      delStmt.run(cat);
    }
  }

  revalidatePath('/finances/expenses');
}
