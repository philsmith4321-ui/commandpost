'use client';
import { useCallback, useEffect, useState } from 'react';

interface Step { step: number; dayOffset: number; subject: string; body: string }
interface SeqLead {
  id: number; business_name: string | null; contact_person: string | null; email: string | null;
  replied_at: string | null; sequence_enrolled_at: string | null;
  steps_sent: number; last_sent_at: string | null; pending_error: string | null;
}
interface EligibleLead {
  id: number; business_name: string | null; contact_person: string | null; email: string | null;
  city: string | null; state: string | null; category: string | null;
}

export default function OutreachSequence() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [enrolled, setEnrolled] = useState<SeqLead[]>([]);
  const [eligible, setEligible] = useState<EligibleLead[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/outreach/sequence');
    if (res.ok) {
      const d = await res.json();
      setSteps(d.steps); setEnrolled(d.enrolled); setEligible(d.eligible ?? []);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch('/api/outreach/sequence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      await load();
    } finally { setBusy(false); }
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? eligible.filter((l) =>
        [l.business_name, l.contact_person, l.email, l.city, l.category]
          .some((f) => (f ?? '').toLowerCase().includes(q)))
    : eligible;

  function togglePick(id: number) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function enrollPicked() {
    if (!picked.size) return;
    await act({ action: 'enroll-many', leadIds: [...picked] });
    setPicked(new Set());
  }

  const total = steps.length || 5;
  const active = enrolled.filter((l) => !l.replied_at && l.steps_sent < total && !l.pending_error).length;
  const done = enrolled.filter((l) => l.steps_sent >= total).length;
  const replied = enrolled.filter((l) => !!l.replied_at).length;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">
          5-Email Sequence
          <span className="ml-3 text-sm font-normal text-gray-400">
            {active} active · {replied} replied · {done} finished
          </span>
        </h2>
        <div className="space-x-2">
          <button onClick={() => setShowTemplates((s) => !s)}
            className="px-3 py-1.5 rounded-lg text-sm bg-gray-800 text-gray-300 hover:bg-gray-700">
            {showTemplates ? 'Hide templates' : 'View templates'}
          </button>
          <button disabled={eligible.length === 0 && !showPicker} onClick={() => setShowPicker((s) => !s)}
            className="px-3 py-1.5 rounded-lg text-sm bg-blue-600 text-white disabled:opacity-40 hover:bg-blue-500">
            {showPicker ? 'Close picker' : `Add companies (${eligible.length} eligible)`}
          </button>
        </div>
      </div>

      {showPicker && (
        <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900/50 p-3">
          <div className="flex items-center gap-2 mb-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, contact, email, city, category…"
              className="flex-1 px-3 py-1.5 rounded-lg bg-gray-950 border border-gray-800 text-sm text-white placeholder-gray-600"
            />
            <button disabled={busy || picked.size === 0} onClick={enrollPicked}
              className="px-3 py-1.5 rounded-lg text-sm bg-emerald-600 text-white disabled:opacity-40 hover:bg-emerald-500 whitespace-nowrap">
              Enroll selected ({picked.size})
            </button>
            <button disabled={busy || filtered.length === 0}
              onClick={() => setPicked(new Set(filtered.map((l) => l.id)))}
              className="px-3 py-1.5 rounded-lg text-sm bg-gray-800 text-gray-300 hover:bg-gray-700 whitespace-nowrap">
              Select all shown
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto rounded-lg border border-gray-800">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-800">
                {filtered.map((l) => (
                  <tr key={l.id} onClick={() => togglePick(l.id)}
                    className={`cursor-pointer ${picked.has(l.id) ? 'bg-blue-950/60' : 'bg-gray-900/40 hover:bg-gray-800/60'}`}>
                    <td className="px-3 py-2 w-8">
                      <input type="checkbox" readOnly checked={picked.has(l.id)} className="accent-blue-500" />
                    </td>
                    <td className="px-3 py-2 text-white">
                      {l.business_name}
                      {l.contact_person ? <span className="text-gray-500"> · {l.contact_person}</span> : null}
                    </td>
                    <td className="px-3 py-2 text-gray-400">{l.email}</td>
                    <td className="px-3 py-2 text-gray-500">{[l.city, l.state].filter(Boolean).join(', ') || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{l.category || '—'}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td className="px-3 py-4 text-gray-500 text-center">No eligible companies match.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showTemplates && (
        <div className="mb-4 space-y-3">
          {steps.map((s) => (
            <details key={s.step} className="rounded-xl border border-gray-800 bg-gray-900/50 p-3">
              <summary className="cursor-pointer text-sm text-gray-200">
                <span className="text-gray-500 mr-2">Day {s.dayOffset + 1}</span>
                Email {s.step}: <span className="text-white">{s.subject}</span>
              </summary>
              <pre className="mt-2 whitespace-pre-wrap text-xs text-gray-400 font-sans">{s.body}</pre>
            </details>
          ))}
        </div>
      )}

      {enrolled.length === 0 ? (
        <p className="text-sm text-gray-500">
          No leads enrolled yet. Enrolling starts the 5-email drip (days 1, 4, 8, 12, 16); it stops
          automatically when a lead replies or is marked do-not-email. Sends go out through the same
          throttled weekday window as the queue.
        </p>
      ) : (
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400 text-left">
              <tr>
                <th className="px-3 py-2">Lead</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Progress</th>
                <th className="px-3 py-2">Last sent</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {enrolled.map((l) => (
                <tr key={l.id} className="bg-gray-900/40">
                  <td className="px-3 py-2 text-white">
                    {l.business_name}
                    {l.contact_person ? <span className="text-gray-500"> · {l.contact_person}</span> : null}
                  </td>
                  <td className="px-3 py-2 text-gray-400">{l.email}</td>
                  <td className="px-3 py-2">
                    {l.replied_at ? (
                      <span className="text-emerald-400">replied · stopped</span>
                    ) : l.pending_error ? (
                      <span className="text-red-400" title={l.pending_error}>error on step {l.steps_sent + 1}</span>
                    ) : l.steps_sent >= total ? (
                      <span className="text-gray-500">finished {total}/{total}</span>
                    ) : (
                      <span className="text-gray-200">{l.steps_sent}/{total} sent</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-500">{l.last_sent_at ? l.last_sent_at.slice(0, 10) : '—'}</td>
                  <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                    {l.pending_error && (
                      <button disabled={busy} onClick={() => act({ action: 'retry', leadId: l.id })}
                        className="px-2 py-1 rounded bg-amber-700 hover:bg-amber-600 text-xs text-white">Retry</button>
                    )}
                    {!l.replied_at && l.steps_sent < total && (
                      <button disabled={busy} onClick={() => act({ action: 'unenroll', leadId: l.id })}
                        className="px-2 py-1 rounded bg-gray-800 hover:bg-red-700 text-xs text-white">Stop</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
