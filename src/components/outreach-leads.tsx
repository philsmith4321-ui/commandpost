'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LaneId } from '@/lib/outreach/lanes';
import type { OutreachLead } from '@/lib/queries/outreach-lead-queries';

interface Counts {
  total: number;
  uncontacted: number;
  replied: number;
}

const fmtDate = (s: string | null) => (s ? s.slice(0, 10) : null);

export function OutreachLeads({ lane }: { lane: LaneId }) {
  const [leads, setLeads] = useState<OutreachLead[]>([]);
  const [counts, setCounts] = useState<Counts>({ total: 0, uncontacted: 0, replied: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'uncontacted'>('all');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Awaits before any setState so it never updates state synchronously inside the effect.
  const load = useCallback(async () => {
    try {
      const qs = filter === 'uncontacted' ? '&uncontacted=1' : '';
      const res = await fetch(`/api/outreach/leads?lane=${lane}${qs}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads);
        setCounts(data.counts);
      }
    } finally {
      setLoading(false);
    }
  }, [lane, filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(leadId: number, body: Record<string, unknown>) {
    await fetch('/api/outreach/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, ...body }),
    });
    load();
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const fd = new FormData();
      fd.set('type', 'leads');
      fd.set('lane', lane);
      fd.set('file', file);
      const res = await fetch('/api/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok) {
        setImportMsg(`Imported ${data.imported} lead${data.imported === 1 ? '' : 's'}${data.skipped ? `, skipped ${data.skipped} (duplicate or no name)` : ''}.`);
        load();
      } else {
        setImportMsg(`Import failed: ${data.error || 'unknown error'}`);
      }
    } catch {
      setImportMsg('Import failed: network error.');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 text-xs">
          <button
            onClick={() => { setLoading(true); setFilter('all'); }}
            className={`px-2.5 py-1 rounded-full border ${filter === 'all' ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-700 text-gray-400 hover:bg-gray-800'}`}
          >
            All {counts.total}
          </button>
          <button
            onClick={() => { setLoading(true); setFilter('uncontacted'); }}
            className={`px-2.5 py-1 rounded-full border ${filter === 'uncontacted' ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-700 text-gray-400 hover:bg-gray-800'}`}
          >
            Not contacted {counts.uncontacted}
          </button>
          <span className="px-2.5 py-1 text-gray-500">Replied {counts.replied}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {importMsg && <span className="text-xs text-gray-400">{importMsg}</span>}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-white disabled:opacity-50"
          >
            {importing ? 'Importing…' : '⬆ Import CSV'}
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onImport} />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 py-8 text-center">Loading…</p>
      ) : leads.length === 0 ? (
        <div className="text-center py-10 text-sm text-gray-500">
          <p>No {lane} leads yet.</p>
          <p className="mt-1">Upload a CSV of your scraped leads to get started — columns like <code className="text-gray-400">business_name, owner, street, city, state, zip, email</code> map automatically.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-500 text-xs">
              <tr>
                <th className="text-left font-medium px-3 py-2">Business</th>
                <th className="text-left font-medium px-3 py-2 hidden sm:table-cell">Location</th>
                <th className="text-left font-medium px-3 py-2">Outreach</th>
                <th className="text-left font-medium px-3 py-2 hidden md:table-cell">Follow-up</th>
                <th className="text-right font-medium px-3 py-2">Mark sent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {leads.map((l) => (
                <LeadRow
                  key={l.id}
                  lead={l}
                  expanded={expanded === l.id}
                  onToggle={() => setExpanded(expanded === l.id ? null : l.id)}
                  onAct={act}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'sent' | 'reply' | 'muted' }) {
  const cls =
    tone === 'sent'
      ? 'bg-emerald-600/20 text-emerald-300'
      : tone === 'reply'
        ? 'bg-amber-500/20 text-amber-300'
        : 'bg-gray-700/40 text-gray-400';
  return <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] ${cls}`}>{children}</span>;
}

function LeadRow({
  lead,
  expanded,
  onToggle,
  onAct,
}: {
  lead: OutreachLead;
  expanded: boolean;
  onToggle: () => void;
  onAct: (leadId: number, body: Record<string, unknown>) => void;
}) {
  const [note, setNote] = useState('');
  const [contact, setContact] = useState({
    street: lead.street ?? '',
    city: lead.city ?? '',
    state: lead.state ?? '',
    postal_code: lead.postal_code ?? '',
    email: lead.email ?? '',
  });
  const letter = fmtDate(lead.letter_sent_at);
  const email = fmtDate(lead.email_sent_at);
  const replied = fmtDate(lead.replied_at);

  return (
    <>
      <tr className="hover:bg-gray-900/50">
        <td className="px-3 py-2 align-top">
          <button onClick={onToggle} className="text-left">
            <span className="text-white font-medium">{lead.business_name}</span>
            {lead.contact_person && <span className="text-gray-400"> · {lead.contact_person}</span>}
            <span className="block text-xs text-gray-600">{expanded ? '▾ hide details' : '▸ details'}</span>
          </button>
        </td>
        <td className="px-3 py-2 align-top text-gray-400 hidden sm:table-cell">
          {[lead.city, lead.state].filter(Boolean).join(', ') || '—'}
        </td>
        <td className="px-3 py-2 align-top space-x-1">
          {letter && <Badge tone="sent">✉ {letter}</Badge>}
          {email && <Badge tone="sent">@ {email}</Badge>}
          {replied && <Badge tone="reply">replied {replied}</Badge>}
          {!letter && !email && !replied && <Badge tone="muted">sourced</Badge>}
        </td>
        <td className="px-3 py-2 align-top hidden md:table-cell">
          <input
            type="date"
            defaultValue={fmtDate(lead.follow_up_date) ?? ''}
            onChange={(e) => onAct(lead.id, { action: 'set-followup', date: e.target.value })}
            className="bg-gray-950 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300"
          />
        </td>
        <td className="px-3 py-2 align-top text-right whitespace-nowrap">
          <button
            onClick={() => onAct(lead.id, { action: 'log-touch', channel: 'letter' })}
            className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-xs text-white"
            title="Log a handwritten letter sent today"
          >
            ✉ Letter
          </button>
          <button
            onClick={() => onAct(lead.id, { action: 'log-touch', channel: 'email' })}
            className="ml-1 px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-xs text-white"
            title="Log an email sent today"
          >
            @ Email
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-900/40">
          <td colSpan={5} className="px-3 py-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Mailing address &amp; email</p>
                <div className="space-y-1.5">
                  <input value={contact.street} onChange={(e) => setContact({ ...contact, street: e.target.value })} placeholder="Street address" className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500" />
                  <div className="flex gap-1.5">
                    <input value={contact.city} onChange={(e) => setContact({ ...contact, city: e.target.value })} placeholder="City" className="flex-1 bg-gray-950 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500" />
                    <input value={contact.state} onChange={(e) => setContact({ ...contact, state: e.target.value })} placeholder="State" className="w-16 bg-gray-950 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500" />
                    <input value={contact.postal_code} onChange={(e) => setContact({ ...contact, postal_code: e.target.value })} placeholder="ZIP" className="w-24 bg-gray-950 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500" />
                  </div>
                  <input value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} placeholder="Email" className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500" />
                  <button onClick={() => onAct(lead.id, { action: 'update-contact', ...contact })} className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs text-white">Save contact</button>
                </div>
                <div className="mt-2 text-xs text-gray-400 space-y-0.5">
                  {lead.phone && <p>☎ {lead.phone}</p>}
                  {lead.website && <p>🌐 {lead.website}</p>}
                  {lead.socials && <p>@ {lead.socials}</p>}
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => onAct(lead.id, { action: 'log-touch', channel: 'phone' })} className="px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-xs text-white">☎ Logged call</button>
                  <button onClick={() => onAct(lead.id, { action: 'mark-replied' })} className="px-2.5 py-1 rounded bg-amber-600/80 hover:bg-amber-600 text-xs text-white">Mark replied</button>
                </div>
                <div>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Add a note (observation, the pain you'll lead with, call outcome)…"
                    rows={2}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => { if (note.trim()) { onAct(lead.id, { action: 'add-note', note }); setNote(''); } }}
                    disabled={!note.trim()}
                    className="mt-1 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs text-white disabled:opacity-40"
                  >
                    Save note
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
