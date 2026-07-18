'use client';

import { useState } from 'react';
import { AudibleStudio } from '@/components/audible-studio';
import { StoriesBrowser, type StoryMeta, type StoryThemeCount } from '@/components/stories-browser';
import type { Generation } from '@/lib/types';

export function AudibleWorkspace({
  categories,
  books,
  bookAuthors,
  storyThemes,
  stories,
  initialHistory,
}: {
  categories: string[];
  books: string[];
  bookAuthors: Record<string, string>;
  storyThemes: StoryThemeCount[];
  stories: StoryMeta[];
  initialHistory: Generation[];
}) {
  const [tab, setTab] = useState<'create' | 'stories'>('create');
  const storyThemeNames = storyThemes.map((t) => t.theme);

  const tabBtn = (id: 'create' | 'stories', label: string) => (
    <button
      onClick={() => setTab(id)}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        tab === id ? 'bg-indigo-600 text-white' : 'bg-gray-900 border border-gray-800 text-gray-300 hover:border-gray-600'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {tabBtn('create', '🎧 Create')}
        {tabBtn('stories', `📖 Stories${stories.length ? ` (${stories.length})` : ''}`)}
      </div>

      {/* Both panels stay mounted; tabs toggle visibility only. Unmounting on
          tab switch would wipe the studio's draft (topic, selections, result,
          client-refreshed history) and any open story every round-trip. */}
      <div className={tab === 'create' ? '' : 'hidden'}>
        <AudibleStudio
          categories={categories}
          books={books}
          bookAuthors={bookAuthors}
          storyThemes={storyThemeNames}
          initialHistory={initialHistory}
        />
      </div>
      <div className={tab === 'stories' ? '' : 'hidden'}>
        <StoriesBrowser storyThemes={storyThemes} stories={stories} />
      </div>
    </div>
  );
}
