'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { parseEmail } from '@/lib/outreach/email-queue';

type Tab = 'review' | 'queued' | 'sent';
interface Lead {
  id: number; business_name: string | null; contact_person: string | null; email: string | null;
  draft_email: string | null; email_status: string | null; email_queued_at: string | null;
  email_sent_at_q: string | null; email_error: string | null; do_not_email: number | null;
}

export default function OutreachEmailQueue() {
  const [tab, setTab] = useState<Tab>('review');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [counts, setCounts] = useState({ review: 0, queued: 0, sent: 0 });
  const [idx, setIdx] = useState(0);
  const [draft, setDraft] = useState('');

  const load = useCallback(async (t: Tab) => {
    const res = await fetch(`/api/outreach/email-queue?tab=${t}`);
    if (res.ok) { const d = await res.json(); setLeads(d.leads); setCounts(d.counts); setIdx(0); }
  }, []);
  useEffect(() => { load(tab); }, [tab, load]);
  useEffect(() => { setDraft(leads[idx]?.draft_email ?? ''); }, [leads, idx]);

  async function act(leadId: number, body: Record<string, unknown>) {
    await fetch('/api/outreach/email-queue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId, ...body }) });
    await load(tab);
  }
  const cur = leads[idx];
  const parsed = useMemo(() => parseEmail(draft || ''), [draft]);

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(['review', 'queued', 'sent'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300'}`}>
            {t[0].toUpperCase() + t.slice(1)} · {counts[t]}
          </button>
        ))}
      </div>

      {tab === 'review' && (cur ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 max-w-2xl">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>{idx + 1} / {leads.length} · <span className="text-white">{cur.business_name}</span>{cur.contact_person ? ` · ${cur.contact_person}` : ''}</span>
            <span className="space-x-2">
              <button disabled={idx === 0} onClick={() => setIdx((i) => i - 1)} className="disabled:opacity-30">◀ prev</button>
              <button disabled={idx >= leads.length - 1} onClick={() => setIdx((i) => i + 1)} className="disabled:opacity-30">next ▶</button>
            </span>
          </div>
          <div className="text-xs text-gray-500">To: {cur.email}</div>
          <div className="text-xs text-gray-500 mb-2">Subject: <span className="text-gray-300">{parsed.subject}</span></div>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => cur && draft !== cur.draft_email && act(cur.id, { action: 'edit', body: draft })}
            rows={12} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white" />
          <div className="mt-2 flex gap-2">
            <button onClick={() => act(cur.id, { action: 'skip' })} className="px-3 py-1 rounded-lg bg-gray-800 hover:bg-red-600 text-xs text-white">✗ Skip</button>
            <button onClick={() => act(cur.id, { action: 'approve' })} className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs text-white">✓ Approve → Queue</button>
            <button onClick={() => act(cur.id, { action: 'do-not-email', on: true })} className="ml-auto px-3 py-1 rounded-lg bg-gray-800 text-xs text-gray-400">Do-not-email</button>
          </div>
        </div>
      ) : <p className="text-gray-500">No drafts to review.</p>)}

      {tab === 'queued' && (
        <div className="space-y-1 max-w-2xl">
          {leads.length === 0 && <p className="text-gray-500">Queue is empty.</p>}
          {leads.map((l, i) => {
            const perDay = 12; const sendsInDays = Math.floor(i / perDay);
            return (
              <div key={l.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2 text-sm">
                <span className="text-white">{l.business_name} <span className="text-gray-500">· {l.email}</span></span>
                <span className="flex items-center gap-3 text-xs text-gray-400">
                  <span>sends in ~{sendsInDays === 0 ? 'today' : sendsInDays + 'd'}</span>
                  <button onClick={() => act(l.id, { action: 'unqueue' })} className="hover:text-white underline">un-queue</button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'sent' && (
        <div className="space-y-1 max-w-2xl">
          {leads.length === 0 && <p className="text-gray-500">Nothing sent yet.</p>}
          {leads.map((l) => (
            <div key={l.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2 text-sm">
              <span className="text-white">{l.business_name} <span className="text-gray-500">· {l.email}</span></span>
              {l.email_status === 'failed'
                ? <span className="flex items-center gap-2 text-xs text-red-400">failed: {l.email_error?.slice(0, 40)} <button onClick={() => act(l.id, { action: 'retry' })} className="underline text-gray-300">retry</button></span>
                : <span className="text-xs text-emerald-400">sent {l.email_sent_at_q?.slice(0, 10)}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
