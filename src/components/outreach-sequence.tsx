'use client';
import { useCallback, useEffect, useState } from 'react';

interface Step { step: number; dayOffset: number; subject: string; body: string }
interface SeqLead {
  id: number; business_name: string | null; contact_person: string | null; email: string | null;
  replied_at: string | null; sequence_enrolled_at: string | null;
  steps_sent: number; last_sent_at: string | null; pending_error: string | null;
}

export default function OutreachSequence() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [enrolled, setEnrolled] = useState<SeqLead[]>([]);
  const [eligible, setEligible] = useState(0);
  const [showTemplates, setShowTemplates] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/outreach/sequence');
    if (res.ok) {
      const d = await res.json();
      setSteps(d.steps); setEnrolled(d.enrolled); setEligible(d.eligibleCount);
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
          <button disabled={busy || eligible === 0} onClick={() => act({ action: 'enroll-all' })}
            className="px-3 py-1.5 rounded-lg text-sm bg-blue-600 text-white disabled:opacity-40 hover:bg-blue-500">
            Enroll all eligible ({eligible})
          </button>
        </div>
      </div>

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
