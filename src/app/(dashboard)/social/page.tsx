'use client';

import { useEffect, useState, useCallback } from 'react';
import type { BufferChannel, BufferPost, ShareMode } from '@/lib/buffer/types';

export default function SocialPage() {
  const [channels, setChannels] = useState<BufferChannel[]>([]);
  const [posts, setPosts] = useState<BufferPost[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // compose state
  const [text, setText] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<ShareMode>('addToQueue');
  const [dueAt, setDueAt] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadQueue = useCallback(async () => {
    const res = await fetch('/api/social/posts');
    const body = await res.json();
    if (!res.ok) { setError(body.error ?? 'Failed to load queue'); return; }
    setError(null);
    setPosts(body.posts);
  }, []);

  useEffect(() => {
    (async () => {
      const statusRes = await fetch('/api/social/status');
      const status = await statusRes.json();
      setConfigured(status.configured);
      setChannels(status.channels ?? []);
      if (status.configured) await loadQueue();
      setLoading(false);
    })();
  }, [loadQueue]);

  function toggleChannel(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    const res = await fetch('/api/social/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelIds: selected, text, mode, dueAt: mode === 'customScheduled' ? new Date(dueAt).toISOString() : undefined }),
    });
    const body = await res.json();
    setSubmitting(false);
    if (!res.ok) { setError(body.error ?? 'Failed to create post'); return; }
    setText(''); setSelected([]); setDueAt('');
    await loadQueue();
  }

  async function remove(id: string) {
    if (!confirm('Delete this post from Buffer?')) return;
    const res = await fetch(`/api/social/posts/${id}`, { method: 'DELETE' });
    if (!res.ok) { const b = await res.json(); setError(b.error ?? 'Delete failed'); return; }
    await loadQueue();
  }

  if (loading) return <div className="p-6 text-gray-400">Loading…</div>;
  if (!configured) return (
    <div className="p-6 text-gray-300">
      Buffer is not configured. See <a href="/settings/social" className="text-blue-400 underline">Settings → Social</a>.
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-3xl">
      <h2 className="text-2xl font-bold mb-6">Social</h2>
      {error && <div className="mb-4 px-4 py-2 bg-red-900 text-red-200 rounded-lg text-sm">{error}</div>}

      {/* Compose */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-8">
        <h3 className="text-sm font-medium text-gray-300 mb-3">New post</h3>
        <textarea
          value={text} onChange={(e) => setText(e.target.value)}
          placeholder="What do you want to post?"
          className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm h-24 outline-none focus:border-blue-500"
        />
        <div className="flex flex-wrap gap-2 my-3">
          {channels.map((c) => (
            <button key={c.id} onClick={() => toggleChannel(c.id)}
              className={`px-3 py-1 rounded-full text-sm border ${selected.includes(c.id) ? 'bg-blue-600 border-blue-500' : 'bg-gray-800 border-gray-700'}`}>
              {c.name} <span className="text-gray-400">({c.platform ?? c.service})</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 mb-3">
          <select value={mode} onChange={(e) => setMode(e.target.value as ShareMode)}
            className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm">
            <option value="addToQueue">Add to queue</option>
            <option value="customScheduled">Schedule for…</option>
            <option value="shareNow">Share now</option>
          </select>
          {mode === 'customScheduled' && (
            <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)}
              className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm" />
          )}
        </div>
        <button onClick={submit} disabled={submitting || !text || !selected.length || (mode === 'customScheduled' && !dueAt)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-medium">
          {submitting ? 'Posting…' : 'Add to Buffer'}
        </button>
      </div>

      {/* Queue */}
      <h3 className="text-sm font-medium text-gray-300 mb-3">Queue</h3>
      <ul className="space-y-3">
        {posts.map((p) => (
          <li key={p.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">
                {p.platform ?? p.channelService} · {p.status}
                {p.dueAt ? ` · ${new Date(p.dueAt).toLocaleString()}` : ''}
              </span>
              {p.allowedActions.includes('delete') && (
                <button onClick={() => remove(p.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
              )}
            </div>
            <p className="text-sm whitespace-pre-wrap">{p.text}</p>
          </li>
        ))}
        {posts.length === 0 && <li className="text-sm text-gray-500">Queue is empty.</li>}
      </ul>
    </div>
  );
}
