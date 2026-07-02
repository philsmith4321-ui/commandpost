'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LaneId } from '@/lib/outreach/lanes';
import type { OutreachLead } from '@/lib/queries/outreach-lead-queries';
import { BUCKETS, type BucketKey } from '@/lib/outreach/employee-size';
import { contactSocialLinks } from '@/lib/outreach/social';

interface Counts {
  total: number;
  uncontacted: number;
  replied: number;
}
interface Facets {
  segments: string[];
  categories: string[];
  cities: string[];
}

const fmtDate = (s: string | null) => (s ? s.slice(0, 10) : null);
const EMPTY_FACETS: Facets = { segments: [], categories: [], cities: [] };

export function OutreachLeads({ lane }: { lane: LaneId }) {
  const [leads, setLeads] = useState<OutreachLead[]>([]);
  const [counts, setCounts] = useState<Counts>({ total: 0, uncontacted: 0, replied: 0 });
  const [facets, setFacets] = useState<Facets>(EMPTY_FACETS);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'uncontacted'>('all');
  // Search filters
  const [segment, setSegment] = useState('');
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [sizes, setSizes] = useState<BucketKey[]>([]);
  const [nearZip, setNearZip] = useState('');
  const [withinMiles, setWithinMiles] = useState('25');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Shared outreach pitch (one global value, used to seed every draft).
  const [pitchOpen, setPitchOpen] = useState(false);
  const [pitch, setPitch] = useState('');
  const [pitchSaving, setPitchSaving] = useState(false);
  const [pitchSaved, setPitchSaved] = useState(false);
  // Bulk email drafting: walk the currently-loaded leads that have an email but no
  // email draft yet, one at a time. Resumable — a re-run skips ones already drafted.
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);
  const bulkStop = useRef(false);

  const sizesKey = sizes.join(',');
  // Awaits before any setState so it never updates state synchronously inside the effect.
  const load = useCallback(async () => {
    try {
      const p = new URLSearchParams({ lane });
      if (filter === 'uncontacted') p.set('uncontacted', '1');
      if (segment) p.set('segment', segment);
      if (category) p.set('category', category);
      if (city) p.set('city', city);
      if (sizesKey) p.set('sizes', sizesKey);
      // Only apply distance once a full 5-digit ZIP is entered.
      if (/^\d{5}$/.test(nearZip) && Number(withinMiles) > 0) {
        p.set('nearZip', nearZip);
        p.set('withinMiles', withinMiles);
      }
      const res = await fetch(`/api/outreach/leads?${p.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads);
        setCounts(data.counts);
        setFacets(data.facets ?? EMPTY_FACETS);
      }
    } finally {
      setLoading(false);
    }
  }, [lane, filter, segment, category, city, sizesKey, nearZip, withinMiles]);

  useEffect(() => {
    load();
  }, [load]);

  // Load the shared pitch once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/outreach/pitch');
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setPitch(typeof data.pitch === 'string' ? data.pitch : '');
        }
      } catch {
        // non-fatal — pitch box just starts empty
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function savePitch() {
    setPitchSaving(true);
    setPitchSaved(false);
    try {
      const res = await fetch('/api/outreach/pitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pitch }),
      });
      if (res.ok) {
        setPitchSaved(true);
        setTimeout(() => setPitchSaved(false), 2000);
      }
    } finally {
      setPitchSaving(false);
    }
  }

  function toggleSize(k: BucketKey) {
    setLoading(true);
    setSizes((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }
  function clearFilters() {
    setLoading(true);
    setSegment('');
    setCategory('');
    setCity('');
    setSizes([]);
    setNearZip('');
  }
  const activeFilterCount =
    (segment ? 1 : 0) + (category ? 1 : 0) + (city ? 1 : 0) + (sizes.length ? 1 : 0) + (/^\d{5}$/.test(nearZip) ? 1 : 0);

  async function act(leadId: number, body: Record<string, unknown>) {
    await fetch('/api/outreach/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, ...body }),
    });
    load();
  }

  // Eligible = currently-loaded leads with an email address and no email draft yet.
  const emailDraftQueue = leads.filter((l) => l.email?.trim() && !l.draft_email?.trim());

  // Sequence actions post to the sequence API, then refresh the list.
  async function seqAct(body: Record<string, unknown>) {
    await fetch('/api/outreach/sequence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    load();
  }

  // Leads in the current view that could be enrolled in the 5-email sequence.
  const seqEligible = leads.filter(
    (l) => l.email?.trim() && !l.sequence_enrolled_at && !l.replied_at && !l.do_not_email
  );

  async function draftAllEmails() {
    const queue = emailDraftQueue;
    if (queue.length === 0 || bulk) return;
    bulkStop.current = false;
    setBulk({ done: 0, total: queue.length });
    for (let i = 0; i < queue.length; i++) {
      if (bulkStop.current) break;
      try {
        await fetch('/api/outreach/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadId: queue[i].id, action: 'draft', channel: 'email' }),
        });
      } catch {
        // Skip failures; the lead stays un-drafted and a re-run will retry it.
      }
      setBulk({ done: i + 1, total: queue.length });
    }
    setBulk(null);
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

      {/* Shared outreach pitch */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50">
        <button
          onClick={() => setPitchOpen((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-2 text-sm text-gray-300 hover:text-white"
        >
          <span className="font-medium">Your outreach pitch</span>
          <span className="text-xs text-gray-500">{pitchOpen ? '▾ hide' : '▸ edit'}</span>
        </button>
        {pitchOpen && (
          <div className="px-3 pb-3">
            <p className="mb-1.5 text-xs text-gray-500">
              Shared across every lead — drafts are personalized from this.
            </p>
            <textarea
              value={pitch}
              onChange={(e) => setPitch(e.target.value)}
              rows={8}
              placeholder="Paste your pitch / value props / proof points here…"
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
            />
            <div className="mt-1.5 flex items-center gap-2">
              <button
                onClick={savePitch}
                disabled={pitchSaving}
                className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs text-white disabled:opacity-50"
              >
                {pitchSaving ? 'Saving…' : 'Save'}
              </button>
              {pitchSaved && <span className="text-xs text-emerald-400">Saved</span>}
            </div>
          </div>
        )}
      </div>

      {/* Bulk email drafting */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-800 bg-gray-900/50 px-3 py-2">
        {bulk ? (
          <>
            <span className="text-sm text-gray-300">
              Drafting emails… <span className="font-medium text-white">{bulk.done}/{bulk.total}</span>
            </span>
            <div className="h-1.5 w-40 overflow-hidden rounded bg-gray-800">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${bulk.total ? (bulk.done / bulk.total) * 100 : 0}%` }}
              />
            </div>
            <button
              onClick={() => { bulkStop.current = true; }}
              className="px-3 py-1 rounded-lg bg-gray-800 hover:bg-red-600 text-xs text-white"
            >
              Stop
            </button>
          </>
        ) : (
          <>
            <button
              onClick={draftAllEmails}
              disabled={emailDraftQueue.length === 0}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm text-white disabled:opacity-40 disabled:hover:bg-emerald-600"
            >
              ✦ Draft all emails
            </button>
            <span className="text-xs text-gray-500">
              {emailDraftQueue.length > 0
                ? `${emailDraftQueue.length} lead${emailDraftQueue.length === 1 ? '' : 's'} in this view need an email draft (have an address, none drafted yet).`
                : 'Every lead in this view with an email already has a draft.'}
            </span>
            <button
              onClick={() => seqAct({ action: 'enroll-many', leadIds: seqEligible.map((l) => l.id) })}
              disabled={seqEligible.length === 0}
              title="Start every eligible lead in this filtered view on the 5-email drip"
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm text-white disabled:opacity-40 disabled:hover:bg-blue-600"
            >
              ⚡ Enroll shown in sequence ({seqEligible.length})
            </button>
          </>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-800 bg-gray-900/50 p-3">
        <FilterSelect label="Segment" value={segment} options={facets.segments} onChange={(v) => { setLoading(true); setSegment(v); }} />
        <FilterSelect label="Category" value={category} options={facets.categories} onChange={(v) => { setLoading(true); setCategory(v); }} />
        <FilterSelect label="City" value={city} options={facets.cities} onChange={(v) => { setLoading(true); setCity(v); }} />
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">Size:</span>
          {BUCKETS.map((b) => (
            <button
              key={b.key}
              onClick={() => toggleSize(b.key)}
              className={`px-2 py-1 rounded text-xs border ${sizes.includes(b.key) ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-700 text-gray-400 hover:bg-gray-800'}`}
            >
              {b.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">Within</span>
          <input
            type="number"
            min={1}
            value={withinMiles}
            onChange={(e) => { setLoading(true); setWithinMiles(e.target.value); }}
            className="w-14 bg-gray-950 border border-gray-700 rounded px-1.5 py-1 text-xs text-white"
          />
          <span className="text-xs text-gray-500">mi of</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="ZIP"
            value={nearZip}
            onChange={(e) => { setLoading(true); setNearZip(e.target.value.replace(/[^\d]/g, '').slice(0, 5)); }}
            className="w-20 bg-gray-950 border border-gray-700 rounded px-1.5 py-1 text-xs text-white"
          />
        </div>
        {activeFilterCount > 0 && (
          <button onClick={clearFilters} className="text-xs text-gray-400 hover:text-white underline">
            Clear ({activeFilterCount})
          </button>
        )}
        <span className="ml-auto text-xs text-gray-500">
          {activeFilterCount > 0 ? `${leads.length} of ${counts.total} match` : `${counts.total} leads`}
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 py-8 text-center">Loading…</p>
      ) : leads.length === 0 ? (
        activeFilterCount > 0 ? (
          <div className="text-center py-10 text-sm text-gray-500">
            <p>No leads match these filters.</p>
            <button onClick={clearFilters} className="mt-2 text-blue-400 hover:text-blue-300 underline">Clear filters</button>
          </div>
        ) : (
          <div className="text-center py-10 text-sm text-gray-500">
            <p>No {lane} leads yet.</p>
            <p className="mt-1">Upload a CSV of your scraped leads to get started — columns like <code className="text-gray-400">business_name, owner, street, city, state, zip, segment, category, employees, email</code> map automatically.</p>
          </div>
        )
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
                  onSeq={seqAct}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-gray-950 border rounded px-2 py-1 text-xs ${value ? 'border-blue-600 text-white' : 'border-gray-700 text-gray-400'}`}
    >
      <option value="">{label}: all</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

// Clickable LinkedIn / Facebook links beside a contact's name. Links straight to a
// stored profile URL when the lead has one, otherwise opens a pre-filled name search.
// Always opens in a new tab so it never navigates away from CommandPost.
function SocialIcon({
  label,
  href,
  direct,
  title,
  tone,
}: {
  label: string;
  href: string;
  direct: boolean;
  title: string;
  tone: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className={`inline-flex h-4 items-center rounded px-1 text-[10px] font-bold leading-none ${
        direct ? `${tone} text-white` : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
      }`}
    >
      {label}
      {!direct && <span className="ml-0.5 opacity-70">⌕</span>}
    </a>
  );
}

function ContactSocials({ name, company, socials }: { name: string; company: string | null; socials: string | null }) {
  const links = contactSocialLinks(name, company, socials);
  return (
    <span className="inline-flex items-center gap-1">
      <SocialIcon
        label="in"
        href={links.linkedin.href}
        direct={links.linkedin.direct}
        tone="bg-sky-600"
        title={links.linkedin.direct ? `Open ${name}'s LinkedIn profile` : `Search LinkedIn for ${name}`}
      />
      <SocialIcon
        label="f"
        href={links.facebook.href}
        direct={links.facebook.direct}
        tone="bg-blue-700"
        title={links.facebook.direct ? `Open ${name}'s Facebook page` : `Search Facebook for ${name}`}
      />
    </span>
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

// Toggle for logging / un-logging a send on a channel. Gray = not sent (click to
// send); green = sent (click to unsend). Lets you flip a touch on and off freely.
function SendToggle({
  icon,
  label,
  sentAt,
  sendDate,
  onSend,
  onUnsend,
}: {
  icon: string;
  label: string;
  sentAt: string | null;
  sendDate?: string;
  onSend: () => void;
  onUnsend: () => void;
}) {
  if (sentAt) {
    return (
      <button
        onClick={onUnsend}
        title={`${label} logged ${sentAt} — click to unsend`}
        className="group px-2 py-1 rounded bg-emerald-600/80 hover:bg-red-600 text-xs text-white"
      >
        <span className="group-hover:hidden">✓ {label}</span>
        <span className="hidden group-hover:inline">✕ Unsend</span>
      </button>
    );
  }
  return (
    <button
      onClick={onSend}
      title={sendDate ? `Log a ${label.toLowerCase()} sent on ${sendDate}` : `Log a ${label.toLowerCase()} sent today`}
      className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-xs text-white"
    >
      {icon} {label}
    </button>
  );
}

// A "sent" status badge that doubles as an unsend control: shows the send date,
// turns red on hover to invite clicking it off. Mirrors SendToggle's behavior.
function UnsendBadge({ label, onUnsend }: { label: string; onUnsend: () => void }) {
  return (
    <button
      onClick={onUnsend}
      title="Click to unsend"
      className="group inline-block px-1.5 py-0.5 rounded text-[11px] bg-emerald-600/20 text-emerald-300 hover:bg-red-600/30 hover:text-red-300"
    >
      <span className="group-hover:hidden">{label}</span>
      <span className="hidden group-hover:inline">✕ unsend</span>
    </button>
  );
}

// Per-lead auto-draft workspace. One editable draft area per channel; the open
// channel's text is AI-generated on demand, seeded from any saved draft, edited
// in place (persisted on blur), copied out, and manually marked sent.
type DraftChannel = 'letter' | 'email' | 'linkedin' | 'fb';
const DRAFT_CHANNELS: { ch: DraftChannel; label: string }[] = [
  { ch: 'letter', label: 'Draft letter' },
  { ch: 'email', label: 'Draft email' },
  { ch: 'linkedin', label: 'Draft LinkedIn' },
  { ch: 'fb', label: 'Draft FB' },
];

function DraftPanel({
  lead,
  onAct,
}: {
  lead: OutreachLead;
  onAct: (leadId: number, body: Record<string, unknown>) => void;
}) {
  const [open, setOpen] = useState<DraftChannel | null>(null);
  const [loading, setLoading] = useState<DraftChannel | null>(null);
  const [copied, setCopied] = useState(false);
  const [drafts, setDrafts] = useState<Record<DraftChannel, string>>({
    letter: lead.draft_letter ?? '',
    email: lead.draft_email ?? '',
    linkedin: lead.draft_linkedin ?? '',
    fb: lead.draft_fb ?? '',
  });
  // Last persisted text per channel, so blur only saves real edits.
  const savedRef = useRef<Record<DraftChannel, string>>({
    letter: lead.draft_letter ?? '',
    email: lead.draft_email ?? '',
    linkedin: lead.draft_linkedin ?? '',
    fb: lead.draft_fb ?? '',
  });

  async function openChannel(ch: DraftChannel) {
    setCopied(false);
    // A saved/typed draft already exists — just focus it.
    if (drafts[ch].trim()) {
      setOpen(ch);
      return;
    }
    setOpen(ch);
    setLoading(ch);
    try {
      const res = await fetch('/api/outreach/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, action: 'draft', channel: ch }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data && typeof data.draft === 'string') {
        setDrafts((d) => ({ ...d, [ch]: data.draft }));
        savedRef.current[ch] = data.draft;
      }
    } finally {
      setLoading(null);
    }
  }

  async function persist(ch: DraftChannel) {
    const body = drafts[ch];
    if (body === savedRef.current[ch]) return;
    savedRef.current[ch] = body;
    await fetch('/api/outreach/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId: lead.id, action: 'save-draft', channel: ch, body }),
    });
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — no-op
    }
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Drafts</p>
      <div className="flex flex-wrap gap-1.5">
        {DRAFT_CHANNELS.map(({ ch, label }) => (
          <button
            key={ch}
            onClick={() => openChannel(ch)}
            className={`px-2.5 py-1 rounded text-xs text-white ${
              open === ch ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-800 hover:bg-gray-700'
            }`}
          >
            {loading === ch ? 'Drafting…' : drafts[ch].trim() ? `✎ ${label}` : label}
          </button>
        ))}
      </div>
      {open && (
        <div className="mt-2">
          <textarea
            value={drafts[open]}
            onChange={(e) => setDrafts((d) => ({ ...d, [open]: e.target.value }))}
            onBlur={() => persist(open)}
            placeholder={loading === open ? 'Drafting…' : 'Your draft will appear here…'}
            rows={6}
            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
          />
          <div className="mt-1 flex items-center gap-2">
            <button
              onClick={() => copy(drafts[open])}
              disabled={!drafts[open].trim()}
              className="px-3 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-white disabled:opacity-40"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={() => onAct(lead.id, { action: 'log-touch', channel: open })}
              className="px-3 py-1 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-xs text-white"
            >
              Mark sent
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LeadRow({
  lead,
  expanded,
  onToggle,
  onAct,
  onSeq,
}: {
  lead: OutreachLead;
  expanded: boolean;
  onToggle: () => void;
  onAct: (leadId: number, body: Record<string, unknown>) => void;
  onSeq: (body: Record<string, unknown>) => void;
}) {
  const [note, setNote] = useState('');
  // Optional backdate for "mark sent": empty = log today, a YYYY-MM-DD = log that day.
  const [sendDate, setSendDate] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const [contact, setContact] = useState({
    street: lead.street ?? '',
    city: lead.city ?? '',
    state: lead.state ?? '',
    postal_code: lead.postal_code ?? '',
    email: lead.email ?? '',
  });
  const letter = fmtDate(lead.letter_sent_at);
  const email = fmtDate(lead.email_sent_at);
  const linkedin = fmtDate(lead.linkedin_sent_at);
  const fb = fmtDate(lead.fb_sent_at);
  const replied = fmtDate(lead.replied_at);

  return (
    <>
      <tr className="hover:bg-gray-900/50">
        <td className="px-3 py-2 align-top">
          <div className="flex flex-wrap items-center gap-x-1">
            <button onClick={onToggle} className="text-left text-white font-medium">
              {lead.business_name}
            </button>
            {lead.contact_person && (
              <>
                <span className="text-gray-400">· {lead.contact_person}</span>
                <ContactSocials name={lead.contact_person} company={lead.business_name} socials={lead.socials} />
              </>
            )}
          </div>
          <button onClick={onToggle} className="block text-left text-xs text-gray-600">
            {expanded ? '▾ hide details' : '▸ details'}
          </button>
        </td>
        <td className="px-3 py-2 align-top text-gray-400 hidden sm:table-cell">
          {[lead.city, lead.state].filter(Boolean).join(', ') || '—'}
        </td>
        <td className="px-3 py-2 align-top space-x-1">
          {letter && (
            <UnsendBadge
              label={`✉ ${letter}`}
              onUnsend={() => onAct(lead.id, { action: 'clear-touch', channel: 'letter' })}
            />
          )}
          {email && (
            <UnsendBadge
              label={`@ ${email}`}
              onUnsend={() => onAct(lead.id, { action: 'clear-touch', channel: 'email' })}
            />
          )}
          {linkedin && (
            <UnsendBadge
              label={`in ${linkedin}`}
              onUnsend={() => onAct(lead.id, { action: 'clear-touch', channel: 'linkedin' })}
            />
          )}
          {fb && (
            <UnsendBadge
              label={`f ${fb}`}
              onUnsend={() => onAct(lead.id, { action: 'clear-touch', channel: 'fb' })}
            />
          )}
          {replied && <Badge tone="reply">replied {replied}</Badge>}
          {!letter && !email && !linkedin && !fb && !replied && <Badge tone="muted">sourced</Badge>}
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
          <div className="inline-flex flex-col gap-1 items-end">
            <input
              type="date"
              value={sendDate}
              max={today}
              onChange={(e) => setSendDate(e.target.value)}
              title="Date you actually sent. Leave empty to log today."
              className={`bg-gray-950 border rounded px-1.5 py-0.5 text-[11px] ${
                sendDate ? 'border-emerald-600 text-white' : 'border-gray-700 text-gray-500'
              }`}
            />
            <div className="flex gap-1 justify-end">
              <SendToggle
                icon="✉"
                label="Letter"
                sentAt={letter}
                sendDate={sendDate}
                onSend={() => onAct(lead.id, { action: 'log-touch', channel: 'letter', sentAt: sendDate || undefined })}
                onUnsend={() => onAct(lead.id, { action: 'clear-touch', channel: 'letter' })}
              />
              <SendToggle
                icon="@"
                label="Email"
                sentAt={email}
                sendDate={sendDate}
                onSend={() => onAct(lead.id, { action: 'log-touch', channel: 'email', sentAt: sendDate || undefined })}
                onUnsend={() => onAct(lead.id, { action: 'clear-touch', channel: 'email' })}
              />
            </div>
            <div className="flex gap-1 justify-end">
              <SendToggle
                icon="in"
                label="LinkedIn"
                sentAt={linkedin}
                sendDate={sendDate}
                onSend={() => onAct(lead.id, { action: 'log-touch', channel: 'linkedin', sentAt: sendDate || undefined })}
                onUnsend={() => onAct(lead.id, { action: 'clear-touch', channel: 'linkedin' })}
              />
              <SendToggle
                icon="f"
                label="FB"
                sentAt={fb}
                sendDate={sendDate}
                onSend={() => onAct(lead.id, { action: 'log-touch', channel: 'fb', sentAt: sendDate || undefined })}
                onUnsend={() => onAct(lead.id, { action: 'clear-touch', channel: 'fb' })}
              />
            </div>
            <div className="flex gap-1 justify-end">
              {lead.sequence_enrolled_at ? (
                <button
                  onClick={() => onSeq({ action: 'unenroll', leadId: lead.id })}
                  title={`In the 5-email sequence (${lead.sequence_steps_sent}/5 sent) — click to stop`}
                  className="group px-2 py-1 rounded bg-blue-600/80 hover:bg-red-600 text-xs text-white"
                >
                  <span className="group-hover:hidden">⚡ Seq {lead.sequence_steps_sent}/5</span>
                  <span className="hidden group-hover:inline">✕ Stop</span>
                </button>
              ) : lead.email?.trim() && !lead.replied_at && !lead.do_not_email ? (
                <button
                  onClick={() => onSeq({ action: 'enroll', leadId: lead.id })}
                  title="Start this lead on the 5-email drip sequence"
                  className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-xs text-white"
                >
                  ⚡ Sequence
                </button>
              ) : null}
            </div>
          </div>
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
                  {lead.contact_person && (
                    <p className="flex items-center gap-1.5 pt-0.5">
                      <span>Find {lead.contact_person} on</span>
                      <ContactSocials name={lead.contact_person} company={lead.business_name} socials={lead.socials} />
                    </p>
                  )}
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
                <DraftPanel lead={lead} onAct={onAct} />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
