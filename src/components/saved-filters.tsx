'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createSavedFilterAction, deleteSavedFilterAction } from '@/lib/actions/saved-filter-actions';

interface SavedFilter {
  id: number;
  name: string;
  page: string;
  params: string;
}

export function SavedFilters({ filters, page, currentParams }: {
  filters: SavedFilter[];
  page: string;
  currentParams: string;
}) {
  const [showSave, setShowSave] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {filters.map(f => (
        <div key={f.id} className="flex items-center gap-1">
          <Link href={`${f.page}${f.params ? '?' + f.params : ''}`}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
              currentParams === f.params ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}>
            {f.name}
          </Link>
          <form action={deleteSavedFilterAction} className="inline">
            <input type="hidden" name="id" value={f.id} />
            <input type="hidden" name="page" value={page} />
            <button type="submit" className="text-xs text-gray-600 hover:text-red-400">x</button>
          </form>
        </div>
      ))}

      {currentParams && !showSave && (
        <button onClick={() => setShowSave(true)} className="px-2 py-1 text-xs text-blue-400 hover:text-blue-300">
          + Save current filter
        </button>
      )}

      {showSave && (
        <form action={createSavedFilterAction} className="flex items-center gap-1">
          <input type="hidden" name="page" value={page} />
          <input type="hidden" name="params" value={currentParams} />
          <input name="name" placeholder="Filter name" required
            className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white w-28" />
          <button type="submit" className="px-2 py-1 text-xs bg-blue-600 text-white rounded">Save</button>
          <button type="button" onClick={() => setShowSave(false)} className="text-xs text-gray-500">Cancel</button>
        </form>
      )}
    </div>
  );
}
