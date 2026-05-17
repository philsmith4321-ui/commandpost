'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function QuickAdd() {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'menu' | 'time' | 'expense' | 'note'>('menu');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const close = () => { setIsOpen(false); setMode('menu'); };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const endpoint = mode === 'time' ? '/api/quick/time' : mode === 'expense' ? '/api/quick/expense' : '/api/quick/note';
    startTransition(async () => {
      await fetch(endpoint, { method: 'POST', body: fd });
      router.refresh();
      close();
    });
  };

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center text-2xl z-50 transition-colors">
        +
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-80 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <span className="text-sm font-medium text-white">
            {mode === 'menu' ? 'Quick Add' : mode === 'time' ? 'Log Time' : mode === 'expense' ? 'Add Expense' : 'Quick Note'}
          </span>
          <button onClick={close} className="text-gray-500 hover:text-white text-sm">x</button>
        </div>

        {mode === 'menu' && (
          <div className="p-2">
            <button onClick={() => setMode('time')} className="w-full text-left px-3 py-2.5 text-sm text-white hover:bg-gray-800 rounded-lg">Log Time</button>
            <button onClick={() => setMode('expense')} className="w-full text-left px-3 py-2.5 text-sm text-white hover:bg-gray-800 rounded-lg">Add Expense</button>
            <button onClick={() => setMode('note')} className="w-full text-left px-3 py-2.5 text-sm text-white hover:bg-gray-800 rounded-lg">Quick Note</button>
          </div>
        )}

        {mode === 'time' && (
          <form onSubmit={handleSubmit} className="p-4 space-y-3">
            <input name="description" placeholder="What did you work on?" required
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
            <div className="flex gap-2">
              <input name="duration_minutes" type="number" placeholder="Minutes" required min="1"
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
              <input name="hourly_rate" type="number" placeholder="Rate" required min="0" step="0.01"
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setMode('menu')} className="px-3 py-2 text-sm text-gray-400 hover:text-white">Back</button>
              <button type="submit" disabled={isPending}
                className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg disabled:opacity-50">
                {isPending ? 'Saving...' : 'Log Time'}
              </button>
            </div>
          </form>
        )}

        {mode === 'expense' && (
          <form onSubmit={handleSubmit} className="p-4 space-y-3">
            <input name="description" placeholder="Description" required
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
            <div className="flex gap-2">
              <input name="amount" type="number" placeholder="Amount" required min="0.01" step="0.01"
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
              <select name="category" className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
                <option value="software">Software</option>
                <option value="servers">Servers</option>
                <option value="contractor">Contractor</option>
                <option value="marketing">Marketing</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setMode('menu')} className="px-3 py-2 text-sm text-gray-400 hover:text-white">Back</button>
              <button type="submit" disabled={isPending}
                className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg disabled:opacity-50">
                {isPending ? 'Saving...' : 'Add Expense'}
              </button>
            </div>
          </form>
        )}

        {mode === 'note' && (
          <form onSubmit={handleSubmit} className="p-4 space-y-3">
            <input name="title" placeholder="Title" required
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
            <textarea name="content" placeholder="Note content..." rows={3}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm resize-none" />
            <div className="flex gap-2">
              <button type="button" onClick={() => setMode('menu')} className="px-3 py-2 text-sm text-gray-400 hover:text-white">Back</button>
              <button type="submit" disabled={isPending}
                className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg disabled:opacity-50">
                {isPending ? 'Saving...' : 'Save Note'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
