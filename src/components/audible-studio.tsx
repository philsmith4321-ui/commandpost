'use client';

import { useState } from 'react';
import {
  ALL_CONTENT_TYPES,
  LENGTH_OPTIONS as LENGTHS,
  MODE_BADGE,
  contentTypeLabel as typeLabel,
} from '@/lib/generation/content-types';
import type { Generation, GenContentType, LengthPreference } from '@/lib/types';

export function AudibleStudio({
  categories,
  books = [],
  storyThemes = [],
  initialHistory,
}: {
  categories: string[];
  books?: string[];
  storyThemes?: string[];
  initialHistory: Generation[];
}) {
  const [history, setHistory] = useState<Generation[]>(initialHistory);

  const [contentType, setContentType] = useState<GenContentType>('blog_article');
  const [topic, setTopic] = useState('');
  const [length, setLength] = useState<LengthPreference>('medium');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Story themes select into their own set — they post as `storyThemes`, a
  // different source kind the generate route expands to that theme's stories.
  const [selectedStories, setSelectedStories] = useState<Set<string>>(new Set());
  const [bookFilter, setBookFilter] = useState('');

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ id: number; text: string; mode: string; used: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const hasSources = categories.length > 0 || books.length > 0 || storyThemes.length > 0;
  const visibleBooks = bookFilter.trim()
    ? books.filter((b) => b.toLowerCase().includes(bookFilter.trim().toLowerCase()))
    : books;
  const selectedBookCount = books.reduce((n, b) => n + (selected.has(b) ? 1 : 0), 0);
  const totalSelected = selected.size + selectedStories.size;

  function toggle(name: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(name)) n.delete(name); else n.add(name);
      return n;
    });
  }
  function toggleStory(name: string) {
    setSelectedStories((prev) => {
      const n = new Set(prev);
      if (n.has(name)) n.delete(name); else n.add(name);
      return n;
    });
  }
  function selectAll() { setSelected(new Set(categories)); }
  function clearAll() { setSelected(new Set()); }

  async function refreshHistory() {
    const res = await fetch('/api/audible/history', { cache: 'no-store' });
    if (res.ok) setHistory((await res.json()).generations);
  }

  const isPrompt = contentType === 'prompt';

  async function generate() {
    if (!topic.trim()) { setError(isPrompt ? 'Enter a prompt.' : 'Enter a topic.'); return; }
    if (totalSelected === 0) { setError('Select at least one theme, book, or story theme.'); return; }
    setBusy(true); setError(null); setResult(null); setCopied(false);
    try {
      const res = await fetch('/api/audible/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType, topic, length, categories: [...selected], storyThemes: [...selectedStories] }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Generation failed'); return; }
      setResult({ id: data.id, text: data.result, mode: data.retrieval_mode, used: data.sources_used });
      refreshHistory();
    } catch {
      setError('Generation failed. Try again.');
    } finally { setBusy(false); }
  }

  async function copy() {
    if (!result) return;
    await navigator.clipboard.writeText(result.text);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }

  async function openHistory(id: number) {
    const res = await fetch(`/api/audible/${id}`);
    if (!res.ok) return;
    const g: Generation = await res.json();
    setContentType(g.content_type);
    setTopic(g.topic);
    setResult({ id: g.id, text: g.result, mode: g.retrieval_mode, used: g.source_count });
    setCopied(false); setError(null);
  }

  async function deleteHistory(id: number) {
    await fetch(`/api/audible/${id}`, { method: 'DELETE' });
    if (result?.id === id) setResult(null);
    refreshHistory();
  }

  return (
    <div className="space-y-5">
      {/* Categories */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-300">Themes</h3>
          {categories.length > 0 && (
            <div className="flex gap-2 text-xs">
              <button onClick={selectAll} className="text-indigo-400 hover:underline">All</button>
              <button onClick={clearAll} className="text-gray-500 hover:underline">None</button>
            </div>
          )}
        </div>
        {categories.length === 0 ? (
          <p className="text-xs text-gray-500">
            No Audible categories synced yet. Run the audible-kb sync (load audible) to populate them.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map((name) => (
              <button key={name} onClick={() => toggle(name)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                  selected.has(name)
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                    : 'bg-gray-950 border-gray-700 text-gray-300 hover:border-gray-600'
                }`}>
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Books (deep notes) */}
      {books.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <h3 className="text-sm font-semibold text-gray-300">
              Books
              <span className="ml-2 text-xs font-normal text-gray-500">
                {selectedBookCount > 0 ? `${selectedBookCount} selected · ` : ''}{books.length} deep notes
              </span>
            </h3>
            <div className="flex items-center gap-2">
              <input
                value={bookFilter}
                onChange={(e) => setBookFilter(e.target.value)}
                placeholder="Filter books…"
                className="w-44 rounded-lg bg-gray-950 border border-gray-700 px-2.5 py-1 text-xs text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none"
              />
              {selectedBookCount > 0 && (
                <button
                  onClick={() => setSelected((prev) => new Set([...prev].filter((n) => !books.includes(n))))}
                  className="text-xs text-gray-500 hover:underline shrink-0">
                  None
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto pr-1">
            {visibleBooks.map((name) => (
              <button key={name} onClick={() => toggle(name)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors border ${
                  selected.has(name)
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                    : 'bg-gray-950 border-gray-700 text-gray-300 hover:border-gray-600'
                }`}>
                {name}
              </button>
            ))}
            {visibleBooks.length === 0 && (
              <p className="text-xs text-gray-500">No books match “{bookFilter}”.</p>
            )}
          </div>
        </div>
      )}

      {/* Stories (personal story themes) — a second source kind, co-draftable with books */}
      {storyThemes.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-300">
              Stories
              <span className="ml-2 text-xs font-normal text-gray-500">
                {selectedStories.size > 0 ? `${selectedStories.size} selected · ` : ''}your personal stories, by theme
              </span>
            </h3>
            {selectedStories.size > 0 && (
              <button onClick={() => setSelectedStories(new Set())} className="text-xs text-gray-500 hover:underline">None</button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {storyThemes.map((name) => (
              <button key={name} onClick={() => toggleStory(name)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                  selectedStories.has(name)
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                    : 'bg-gray-950 border-gray-700 text-gray-300 hover:border-gray-600'
                }`}>
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content type */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <label className="block text-sm font-semibold text-gray-300 mb-3">Content type</label>
        <div className="flex flex-wrap gap-2">
          {ALL_CONTENT_TYPES.map((t) => (
            <button key={t.value} onClick={() => setContentType(t.value)}
              className={`px-3 py-2 rounded-lg text-sm text-left transition-colors border ${
                contentType === t.value
                  ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                  : 'bg-gray-950 border-gray-700 text-gray-300 hover:border-gray-600'
              }`}>
              <span className="font-medium">{t.label}</span>
              <span className="block text-xs text-gray-500">{t.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Topic + length */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
        <label className="block text-sm font-semibold text-gray-300">{isPrompt ? 'Prompt' : 'Topic / brief'}</label>
        <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={4}
          placeholder={isPrompt
            ? 'Ask anything of the selected content — questions, summaries, comparisons, how to apply it…'
            : 'What should this be about? Add any angle, audience, or key points…'}
          className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none" />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Length:</span>
            {LENGTHS.map((l) => (
              <button key={l.value} onClick={() => setLength(l.value)}
                className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                  length === l.value ? 'bg-indigo-600/20 text-indigo-300' : 'text-gray-400 hover:bg-gray-800'
                }`}>{l.label}</button>
            ))}
          </div>
          <span className="text-xs text-gray-500">
            {totalSelected} source{totalSelected === 1 ? '' : 's'} selected
          </span>
        </div>
        <button onClick={generate} disabled={busy || !hasSources}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold transition-colors">
          {busy ? (isPrompt ? 'Thinking…' : 'Generating…') : isPrompt ? '🎧 Ask' : '🎧 Generate'}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>

      {/* Result */}
      {result && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-300">{typeLabel(contentType)}</span>
              <span className={`px-2 py-0.5 rounded text-xs ${MODE_BADGE[result.mode] ?? MODE_BADGE.none}`}>
                {result.mode === 'vector' ? 'vector RAG' : result.mode === 'keyword' ? 'keyword match' : 'no sources'}
                {result.used ? ` · ${result.used} chunks` : ''}
              </span>
            </div>
            <button onClick={copy} className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs transition-colors">
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className="text-sm text-gray-200 whitespace-pre-wrap font-sans leading-relaxed">{result.text}</pre>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">History</h3>
          <div className="space-y-1.5">
            {history.map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-3 rounded-lg hover:bg-gray-800/60 px-2 py-1.5">
                <button onClick={() => openHistory(g.id)} className="min-w-0 text-left flex-1">
                  <p className="text-sm text-white truncate">{g.topic}</p>
                  <p className="text-xs text-gray-500">
                    {typeLabel(g.content_type)} · {g.created_at} · {g.source_count} source{g.source_count === 1 ? '' : 's'}
                  </p>
                </button>
                <button onClick={() => deleteHistory(g.id)}
                  className="px-2 py-1 rounded text-xs text-gray-500 hover:text-red-300 shrink-0">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
