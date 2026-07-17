'use client';

import { useMemo, useState } from 'react';

export interface StoryMeta {
  id: number;
  label: string;
  theme: string;
}

export interface StoryThemeCount {
  theme: string;
  count: number;
}

interface LoadedStory {
  id: number;
  label: string;
  theme: string | null;
  content: string;
  matched?: boolean;
}

export function StoriesBrowser({
  storyThemes,
  stories,
}: {
  storyThemes: StoryThemeCount[];
  stories: StoryMeta[];
}) {
  const [activeTheme, setActiveTheme] = useState<string | null>(null);
  const [story, setStory] = useState<LoadedStory | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [pulling, setPulling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storiesByTheme = useMemo(() => {
    const m = new Map<string, StoryMeta[]>();
    for (const s of stories) {
      if (!m.has(s.theme)) m.set(s.theme, []);
      m.get(s.theme)!.push(s);
    }
    for (const list of m.values()) list.sort((a, b) => a.label.localeCompare(b.label));
    return m;
  }, [stories]);

  async function openStory(id: number) {
    setLoadingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/audible/story/${id}`, { cache: 'no-store' });
      if (!res.ok) { setError('Could not load that story.'); return; }
      setStory(await res.json());
    } catch {
      setError('Could not load that story.');
    } finally {
      setLoadingId(null);
    }
  }

  async function pull() {
    setPulling(true);
    setError(null);
    try {
      const res = await fetch('/api/audible/stories/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: activeTheme ?? undefined, query: query.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'No story found.'); return; }
      setStory(data);
    } catch {
      setError('Could not pull a story.');
    } finally {
      setPulling(false);
    }
  }

  const themeStories = activeTheme ? storiesByTheme.get(activeTheme) ?? [] : [];

  return (
    <div className="space-y-5">
      {/* Ask / Pull a story */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-300">Pull a story</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') pull(); }}
            placeholder={activeTheme ? `Search “${activeTheme}” (or leave blank for a random one)…` : 'Search all stories (or leave blank for a random one)…'}
            className="flex-1 rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none"
          />
          <button
            onClick={pull}
            disabled={pulling}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors shrink-0"
          >
            {pulling ? 'Finding…' : query.trim() ? '🔎 Find a story' : '🎲 Random story'}
          </button>
        </div>
        {activeTheme && (
          <p className="text-xs text-gray-500">
            Scoped to <span className="text-indigo-300">{activeTheme}</span>.{' '}
            <button onClick={() => setActiveTheme(null)} className="text-gray-400 hover:underline">Search all themes</button>
          </p>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>

      {/* Theme cards */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Themes</h3>
        {storyThemes.length === 0 ? (
          <p className="text-xs text-gray-500">No stories ingested yet. Run <code className="text-gray-400">npm run ingest:stories</code>.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {storyThemes.map(({ theme, count }) => (
              <button
                key={theme}
                onClick={() => setActiveTheme((t) => (t === theme ? null : theme))}
                className={`text-left px-3 py-2.5 rounded-xl border transition-colors ${
                  activeTheme === theme
                    ? 'bg-indigo-600/20 border-indigo-500'
                    : 'bg-gray-950 border-gray-700 hover:border-gray-600'
                }`}
              >
                <span className="block text-sm text-gray-200 leading-tight">{theme}</span>
                <span className="text-xs text-gray-500">{count} {count === 1 ? 'story' : 'stories'}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stories in the selected theme */}
      {activeTheme && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">
            {activeTheme}
            <span className="ml-2 text-xs font-normal text-gray-500">{themeStories.length} stories</span>
          </h3>
          <div className="flex flex-col gap-1 max-h-80 overflow-y-auto pr-1">
            {themeStories.map((s) => (
              <button
                key={s.id}
                onClick={() => openStory(s.id)}
                className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  story?.id === s.id ? 'bg-indigo-600/20 text-indigo-300' : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                {loadingId === s.id ? 'Loading…' : s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected story */}
      {story && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <div>
              <h3 className="text-base font-semibold text-white">{story.label}</h3>
              {story.theme && <p className="text-xs text-gray-500">{story.theme}{story.matched === false ? ' · random pick' : ''}</p>}
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(story.content)}
              className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs transition-colors shrink-0"
            >
              Copy
            </button>
          </div>
          <pre className="text-sm text-gray-200 whitespace-pre-wrap font-sans leading-relaxed">{story.content}</pre>
        </div>
      )}
    </div>
  );
}
