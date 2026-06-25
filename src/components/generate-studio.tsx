'use client';

import { useMemo, useState } from 'react';
import { CONTENT_TYPES } from '@/lib/generation/content-types';
import { AvatarManager } from '@/components/avatar-manager';
import type { KbDocument, KbSourceType, Generation, GenContentType, LengthPreference, Avatar } from '@/lib/types';

type SourceItem = Omit<KbDocument, 'content'>;

const LENGTHS: { value: LengthPreference; label: string }[] = [
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'long', label: 'Long' },
];
const TYPE_FILTERS: ('all' | KbSourceType)[] = ['all', 'website', 'pdf', 'html', 'text', 'book'];

const MODE_BADGE: Record<string, string> = {
  vector: 'bg-green-600/20 text-green-400',
  keyword: 'bg-amber-600/20 text-amber-400',
  none: 'bg-gray-700 text-gray-300',
};

function typeLabel(c: GenContentType): string {
  return CONTENT_TYPES.find((t) => t.value === c)?.label ?? c;
}

export function GenerateStudio({
  initialSources,
  initialHistory,
  avatars: initialAvatars,
}: {
  initialSources: SourceItem[];
  initialHistory: Generation[];
  avatars: Avatar[];
}) {
  const [sources] = useState<SourceItem[]>(initialSources);
  const [history, setHistory] = useState<Generation[]>(initialHistory);
  const [avatars, setAvatars] = useState<Avatar[]>(initialAvatars);

  const activeAvatars = useMemo(() => avatars.filter((a) => a.is_active), [avatars]);

  const [contentType, setContentType] = useState<GenContentType>('blog_article');
  const [topic, setTopic] = useState('');
  const [length, setLength] = useState<LengthPreference>('medium');
  const [avatarSel, setAvatarSel] = useState<'none' | 'all' | number>('none');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<'all' | KbSourceType>('all');

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ id: number; text: string; mode: string; used: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const shownSources = useMemo(
    () => (filter === 'all' ? sources : sources.filter((s) => s.source_type === filter)),
    [sources, filter]
  );

  function toggle(id: number) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function selectAllShown() {
    setSelected((prev) => { const n = new Set(prev); shownSources.forEach((s) => n.add(s.id)); return n; });
  }
  function clearAll() { setSelected(new Set()); }

  async function refreshHistory() {
    const res = await fetch('/api/generate/history', { cache: 'no-store' });
    if (res.ok) setHistory((await res.json()).generations);
  }

  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);

  async function backfillToBuffer() {
    setBackfilling(true);
    setBackfillMsg(null);
    const res = await fetch('/api/generate/backfill-buffer', { method: 'POST' });
    const body = await res.json();
    setBackfilling(false);
    if (!res.ok) { setBackfillMsg(body.error ?? 'Backfill failed'); return; }
    setBackfillMsg(`Pushed ${body.pushed}, skipped ${body.skipped}${body.failed ? `, failed ${body.failed}` : ''}`);
    refreshHistory();
  }

  async function generate() {
    if (!topic.trim()) { setError('Enter a topic.'); return; }
    setBusy(true); setError(null); setResult(null); setCopied(false);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType, topic, length, sourceIds: [...selected],
          avatar: avatarSel === 'none' ? null : avatarSel,
        }),
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
    const res = await fetch(`/api/generate/${id}`);
    if (!res.ok) return;
    const g: Generation = await res.json();
    setContentType(g.content_type);
    setTopic(g.topic);
    setResult({ id: g.id, text: g.result, mode: g.retrieval_mode, used: g.source_count });
    setCopied(false); setError(null);
  }

  async function deleteHistory(id: number) {
    await fetch(`/api/generate/${id}`, { method: 'DELETE' });
    if (result?.id === id) setResult(null);
    refreshHistory();
  }

  return (
    <div className="space-y-5">
      {/* Content type */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <label className="block text-sm font-semibold text-gray-300 mb-3">Content type</label>
          <div className="flex flex-wrap gap-2">
            {CONTENT_TYPES.map((t) => (
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
          <label className="block text-sm font-semibold text-gray-300">Topic / brief</label>
          <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={4}
            placeholder="What should this be about? Add any angle, audience, or key points…"
            className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none" />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Length:</span>
                {LENGTHS.map((l) => (
                  <button key={l.value} onClick={() => setLength(l.value)}
                    className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                      length === l.value ? 'bg-indigo-600/20 text-indigo-300' : 'text-gray-400 hover:bg-gray-800'
                    }`}>{l.label}</button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Audience:</span>
                <span className="text-[11px] text-pink-400/80 mr-1">Master Profile: always applied</span>
                <select
                  value={String(avatarSel)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setAvatarSel(v === 'none' || v === 'all' ? v : Number(v));
                  }}
                  className="rounded-lg bg-gray-950 border border-gray-700 px-2 py-1 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="none">Master only (no vertical)</option>
                  {activeAvatars.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  {activeAvatars.length >= 2 && <option value="all">All verticals ⚠ generic</option>}
                </select>
              </div>
            </div>
            <span className="text-xs text-gray-500">{selected.size} source{selected.size === 1 ? '' : 's'} selected</span>
          </div>
          <button onClick={generate} disabled={busy}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold transition-colors">
            {busy ? 'Generating…' : '✦ Generate'}
          </button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        {/* Knowledge sources */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-300">Knowledge sources</h3>
            <div className="flex gap-2 text-xs">
              <button onClick={selectAllShown} className="text-indigo-400 hover:underline">All</button>
              <button onClick={clearAll} className="text-gray-500 hover:underline">None</button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {TYPE_FILTERS.map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-2 py-0.5 rounded text-xs capitalize transition-colors ${
                  filter === f ? 'bg-indigo-600/20 text-indigo-300' : 'text-gray-400 hover:bg-gray-800'
                }`}>{f}</button>
            ))}
          </div>

          {shownSources.length === 0 ? (
            <p className="text-xs text-gray-500">No sources{filter !== 'all' ? ' of this type' : ''}. Add some on the Ingestion page.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-1 max-h-[28rem] overflow-y-auto pr-1">
              {shownSources.map((s) => (
                <label key={s.id} className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-800/60 cursor-pointer">
                  <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)}
                    className="mt-0.5 accent-indigo-500" />
                  <span className="min-w-0">
                    <span className="block text-sm text-white truncate">{s.title}</span>
                    <span className="block text-xs text-gray-500 capitalize">{s.source_type}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Audience avatars */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-gray-300">Audience avatars</h3>
            <p className="text-xs text-gray-500">Personas you can target in the Audience selector above</p>
          </div>
          <AvatarManager initialAvatars={avatars} onAvatarsChange={setAvatars} />
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
              <div className="flex items-center gap-2">
                <button onClick={copy} className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs transition-colors">
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
            <pre className="text-sm text-gray-200 whitespace-pre-wrap font-sans leading-relaxed">{result.text}</pre>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-300">History</h3>
              <div className="flex items-center gap-2">
                {backfillMsg && <span className="text-xs text-gray-500">{backfillMsg}</span>}
                <button onClick={backfillToBuffer} disabled={backfilling}
                  className="text-xs px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 transition-colors">
                  {backfilling ? 'Sending…' : 'Send social to Buffer'}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              {history.map((g) => (
                <div key={g.id} className="flex items-center justify-between gap-3 rounded-lg hover:bg-gray-800/60 px-2 py-1.5">
                  <button onClick={() => openHistory(g.id)} className="min-w-0 text-left flex-1">
                    <p className="text-sm text-white truncate">{g.topic}</p>
                    <p className="text-xs text-gray-500">
                      {typeLabel(g.content_type)} · {g.created_at}
                      {g.buffer_post_id && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-green-900 text-green-300">In Buffer (draft)</span>
                      )}
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
