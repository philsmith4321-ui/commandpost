'use client';

import { useState } from 'react';
import type { Avatar } from '@/lib/types';

const EMPTY = {
  name: '', summary: '', description: '', tone: '', is_active: true,
  persona: '', buying_trigger: '', proof_point: '', writing_target: '', what_tried: '',
  pains: '', desires: '', objections: '', vocabulary: '', trust_triggers: '', channels: '',
};
type Draft = typeof EMPTY;

const linesToArray = (s: string): string[] => s.split('\n').map((x) => x.trim()).filter(Boolean);
const arrayToLines = (a: string[]): string => a.join('\n');

export function AvatarManager({
  initialAvatars,
  onAvatarsChange,
}: {
  initialAvatars: Avatar[];
  onAvatarsChange?: (avatars: Avatar[]) => void;
}) {
  const [avatars, setAvatars] = useState<Avatar[]>(initialAvatars);
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const res = await fetch('/api/avatars', { cache: 'no-store' });
    if (res.ok) {
      const updated: Avatar[] = (await res.json()).avatars;
      setAvatars(updated);
      onAvatarsChange?.(updated);
    }
  }

  function startNew() { setEditingId('new'); setDraft(EMPTY); }
  function startEdit(a: Avatar) {
    setEditingId(a.id);
    setDraft({
      name: a.name, summary: a.summary ?? '', description: a.description ?? '', tone: a.tone ?? '', is_active: !!a.is_active,
      persona: a.persona ?? '', buying_trigger: a.buying_trigger ?? '', proof_point: a.proof_point ?? '',
      writing_target: a.writing_target ?? '', what_tried: a.what_tried ?? '',
      pains: arrayToLines(a.pains), desires: arrayToLines(a.desires), objections: arrayToLines(a.objections),
      vocabulary: arrayToLines(a.vocabulary), trust_triggers: arrayToLines(a.trust_triggers), channels: arrayToLines(a.channels),
    });
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
        body: JSON.stringify({
          name: draft.name, summary: draft.summary, description: draft.description, tone: draft.tone, is_active: draft.is_active,
          persona: draft.persona, buying_trigger: draft.buying_trigger, proof_point: draft.proof_point,
          writing_target: draft.writing_target, what_tried: draft.what_tried,
          pains: linesToArray(draft.pains), desires: linesToArray(draft.desires), objections: linesToArray(draft.objections),
          vocabulary: linesToArray(draft.vocabulary), trust_triggers: linesToArray(draft.trust_triggers), channels: linesToArray(draft.channels),
        }),
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
    <div className="space-y-4">
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
          <Field label="Persona" hint="e.g. David, the Fiduciary">
            <input value={draft.persona} onChange={(e) => setDraft({ ...draft, persona: e.target.value })}
              className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-pink-500 focus:outline-none" />
          </Field>
          <Field label="Pains" hint="in their words — one per line">
            <textarea value={draft.pains} onChange={(e) => setDraft({ ...draft, pains: e.target.value })} rows={4}
              className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-pink-500 focus:outline-none" />
          </Field>
          <Field label="Desired outcomes" hint="one per line">
            <textarea value={draft.desires} onChange={(e) => setDraft({ ...draft, desires: e.target.value })} rows={2}
              className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-pink-500 focus:outline-none" />
          </Field>
          <Field label="Vertical-specific objections" hint="one per line">
            <textarea value={draft.objections} onChange={(e) => setDraft({ ...draft, objections: e.target.value })} rows={3}
              className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-pink-500 focus:outline-none" />
          </Field>
          <Field label="Vocabulary" hint="words/phrases — one per line">
            <textarea value={draft.vocabulary} onChange={(e) => setDraft({ ...draft, vocabulary: e.target.value })} rows={3}
              className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-pink-500 focus:outline-none" />
          </Field>
          <Field label="Trust triggers" hint="one per line">
            <textarea value={draft.trust_triggers} onChange={(e) => setDraft({ ...draft, trust_triggers: e.target.value })} rows={3}
              className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-pink-500 focus:outline-none" />
          </Field>
          <Field label="Channels" hint="one per line">
            <textarea value={draft.channels} onChange={(e) => setDraft({ ...draft, channels: e.target.value })} rows={2}
              className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-pink-500 focus:outline-none" />
          </Field>
          <Field label="Buying trigger">
            <input value={draft.buying_trigger} onChange={(e) => setDraft({ ...draft, buying_trigger: e.target.value })}
              className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-pink-500 focus:outline-none" />
          </Field>
          <Field label="What they've tried">
            <textarea value={draft.what_tried} onChange={(e) => setDraft({ ...draft, what_tried: e.target.value })} rows={2}
              className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-pink-500 focus:outline-none" />
          </Field>
          <Field label="Proof point" hint="real credibility to inject">
            <input value={draft.proof_point} onChange={(e) => setDraft({ ...draft, proof_point: e.target.value })}
              className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-pink-500 focus:outline-none" />
          </Field>
          <Field label="Writing target" hint="the one-sentence anchor instruction">
            <textarea value={draft.writing_target} onChange={(e) => setDraft({ ...draft, writing_target: e.target.value })} rows={3}
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
