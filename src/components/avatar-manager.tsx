'use client';

import { useState } from 'react';
import type { Avatar } from '@/lib/types';

const EMPTY = { name: '', summary: '', description: '', tone: '', is_active: true };
type Draft = { name: string; summary: string; description: string; tone: string; is_active: boolean };

export function AvatarManager({ initialAvatars }: { initialAvatars: Avatar[] }) {
  const [avatars, setAvatars] = useState<Avatar[]>(initialAvatars);
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const res = await fetch('/api/avatars', { cache: 'no-store' });
    if (res.ok) setAvatars((await res.json()).avatars);
  }

  function startNew() { setEditingId('new'); setDraft(EMPTY); }
  function startEdit(a: Avatar) {
    setEditingId(a.id);
    setDraft({ name: a.name, summary: a.summary ?? '', description: a.description ?? '', tone: a.tone ?? '', is_active: !!a.is_active });
  }
  function cancel() { setEditingId(null); setDraft(EMPTY); }

  async function save() {
    if (!draft.name.trim()) return;
    setBusy(true);
    try {
      const isNew = editingId === 'new';
      const res = await fetch(isNew ? '/api/avatars' : `/api/avatars/${editingId}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (res.ok) { cancel(); refresh(); }
    } finally { setBusy(false); }
  }

  async function remove(id: number) {
    if (!confirm('Delete this avatar?')) return;
    await fetch(`/api/avatars/${id}`, { method: 'DELETE' });
    if (editingId === id) cancel();
    refresh();
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex justify-end">
        <button onClick={startNew}
          className="px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-sm font-medium transition-colors">
          + New Avatar
        </button>
      </div>

      {editingId !== null && (
        <div className="bg-gray-900 border border-pink-600/40 rounded-2xl p-5 space-y-3">
          <h3 className="font-semibold">{editingId === 'new' ? 'New avatar' : 'Edit avatar'}</h3>
          <Field label="Name" hint="e.g. Pre-Retiree Pete">
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Persona name"
              className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-pink-500 focus:outline-none" />
          </Field>
          <Field label="Summary" hint="one-line demographic / snapshot">
            <input value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
              placeholder="e.g. Male, 42-55, mid-career professional"
              className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-pink-500 focus:outline-none" />
          </Field>
          <Field label="Description" hint="goals, pain points, what resonates, objections">
            <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={4}
              placeholder="Who they are, what they want, what worries them, and what messaging lands…"
              className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-pink-500 focus:outline-none" />
          </Field>
          <Field label="Tone" hint="optional voice guidance for this audience">
            <input value={draft.tone} onChange={(e) => setDraft({ ...draft, tone: e.target.value })}
              placeholder="e.g. reassuring, plain-spoken, no jargon"
              className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-pink-500 focus:outline-none" />
          </Field>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
              className="accent-pink-500" />
            Active (available in the Generate “All avatars” option)
          </label>
          <div className="flex gap-2">
            <button onClick={save} disabled={busy || !draft.name.trim()}
              className="px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button onClick={cancel} className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {avatars.length === 0 ? (
        <p className="text-gray-500 text-sm">No avatars yet. Create one to target it when generating content.</p>
      ) : (
        <div className="space-y-2">
          {avatars.map((a) => (
            <div key={a.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-white">
                    {a.name}
                    {!a.is_active && <span className="ml-2 text-xs text-gray-500">(inactive)</span>}
                  </p>
                  {a.summary && <p className="text-sm text-gray-400">{a.summary}</p>}
                  {a.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2 whitespace-pre-wrap">{a.description}</p>}
                  {a.tone && <p className="text-xs text-pink-400/80 mt-1">Tone: {a.tone}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => startEdit(a)} className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs transition-colors">Edit</button>
                  <button onClick={() => remove(a.id)} className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-red-900/40 text-xs text-gray-400 hover:text-red-300 transition-colors">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}{hint && <span className="text-gray-600"> — {hint}</span>}</label>
      {children}
    </div>
  );
}
