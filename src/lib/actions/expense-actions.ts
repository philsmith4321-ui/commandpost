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
}
