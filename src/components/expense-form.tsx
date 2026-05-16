'use client';

import { useRef } from 'react';
import { createExpenseAction } from '@/lib/actions/expense-actions';
import type { Client } from '@/lib/types';

interface ExpenseFormProps {
  clients: Pick<Client, 'id' | 'name'>[];
}

export function ExpenseForm({ clients }: ExpenseFormProps) {
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    await createExpenseAction(formData);
    formRef.current?.reset();
  }

  return (
    <form ref={formRef} action={handleSubmit} className="p-4 bg-gray-900 border border-gray-800 rounded-lg mb-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <input type="date" name="expense_date" required defaultValue={new Date().toISOString().split('T')[0]}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
        <input type="text" name="description" required placeholder="Description"
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
        <select name="category" defaultValue="other"
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500">
          <option value="servers">Servers/Hosting</option>
          <option value="software">Software/APIs</option>
          <option value="contractor">Contractor</option>
          <option value="marketing">Marketing</option>
          <option value="other">Other</option>
        </select>
        <input type="number" name="amount" required step="0.01" min="0" placeholder="Amount"
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 text-right focus:outline-none focus:border-blue-500" />
        <select name="client_id" defaultValue=""
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500">
          <option value="">No client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="mt-3 flex justify-end">
        <button type="submit"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
          Add Expense
        </button>
      </div>
    </form>
  );
}
