'use client';

import { useActionState } from 'react';
import { askDashboardQuestion, type QueryResult } from '@/lib/actions/dashboard-actions';

export function DashboardQuery() {
  const [state, formAction, isPending] = useActionState<QueryResult | null, FormData>(
    askDashboardQuestion,
    null
  );

  return (
    <div className="mb-6">
      <form action={formAction} className="flex gap-2">
        <input
          type="text"
          name="question"
          placeholder="Ask about your business..."
          className="flex-1 px-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          disabled={isPending}
        />
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:text-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {isPending ? 'Thinking...' : 'Ask'}
        </button>
      </form>
      {state && (
        <div className={`mt-3 p-4 rounded-lg border text-sm ${
          'error' in state
            ? 'bg-red-900/10 border-red-900 text-red-400'
            : 'bg-gray-900 border-gray-800 text-white'
        }`}>
          {'error' in state ? state.error : state.answer}
        </div>
      )}
    </div>
  );
}
