'use client';
import { useCallback, useEffect, useState } from 'react';
import { contactSocialLinks } from '@/lib/outreach/social';

interface QueueLead {
  id: number;
  business_name: string | null;
  contact_person: string | null;
  city: string | null;
  state: string | null;
  category: string | null;
  socials: string | null;
  draft_linkedin: string | null;
}

export default function OutreachLinkedInQueue() {
  const [queue, setQueue] = useState<QueueLead[]>([]);
  const [sentCount, setSentCount] = useState(0);
  const [idx, setIdx] = useState(0);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (keepIdx = false) => {
    const res = await fetch('/api/outreach/linkedin-queue');
    if (res.ok) {
      const d = await res.json();
      setQueue(d.queue);
      setSentCount(d.sentCount);
      if (!keepIdx) setIdx(0);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const cur = queue[Math.min(idx, Math.max(queue.length - 1, 0))];
  useEffect(() => { setDraft(cur?.draft_linkedin ?? ''); setCopied(false); }, [cur]);

  async function act(leadId: number, body: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch('/api/outreach/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, ...body }),
      });
    } finally { setBusy(false); }
  }

  async function copyDraft() {
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    if (cur && draft !== cur.draft_linkedin) {
      await act(cur.id, { action: 'save-draft', channel: 'linkedin', body: draft });
    }
  }

  async function markSent() {
    if (!cur) return;
    if (draft !== cur.draft_linkedin) {
      await act(cur.id, { action: 'save-draft', channel: 'linkedin', body: draft });
    }
    await act(cur.id, { action: 'log-touch', channel: 'linkedin' });
    // Removing the sent lead shifts the list; keep the same index to land on the next one.
    await load(true);
  }

  async function regenerate() {
    if (!cur) return;
    await act(cur.id, { action: 'draft', channel: 'linkedin' });
    await load(true);
  }

  if (!cur) {
    return (
      <p className="text-sm text-gray-500">
        Nothing left to send — {sentCount} LinkedIn message{sentCount === 1 ? '' : 's'} logged. 🎉
      </p>
    );
  }

  const links = contactSocialLinks(cur.contact_person ?? '', cur.business_name, cur.socials);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 max-w-2xl">
      <div className="flex justify-between text-sm text-gray-400 mb-1">
        <span>
          {idx + 1} / {queue.length} to send · {sentCount} sent
        </span>
        <span className="space-x-2">
          <button disabled={idx === 0} onClick={() => setIdx((i) => i - 1)} className="disabled:opacity-30">◀ prev</button>
          <button disabled={idx >= queue.length - 1} onClick={() => setIdx((i) => i + 1)} className="disabled:opacity-30">next ▶</button>
        </span>
      </div>

      <div className="mb-3">
        <div className="text-white font-medium">{cur.business_name}</div>
        <div className="text-sm text-gray-400">
          {cur.contact_person}
          {cur.category ? ` · ${cur.category}` : ''}
          {cur.city ? ` · ${[cur.city, cur.state].filter(Boolean).join(', ')}` : ''}
        </div>
      </div>

      <a
        href={links.linkedin.href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block mb-3 px-3 py-1.5 rounded-lg bg-[#0a66c2] hover:bg-[#0a5cb0] text-sm text-white"
      >
        {links.linkedin.direct ? 'in · Open profile' : `in · Find ${cur.contact_person?.split(/\s+/)[0]} on LinkedIn`}
      </a>

      <textarea
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setCopied(false); }}
        rows={9}
        className="w-full rounded-lg bg-gray-950 border border-gray-800 p-3 text-sm text-gray-200 leading-relaxed"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={copyDraft}
          className={`px-3 py-1.5 rounded-lg text-sm text-white ${copied ? 'bg-emerald-700' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
          {copied ? '✓ Copied' : '⧉ Copy message'}
        </button>
        <button disabled={busy} onClick={markSent}
          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm text-white disabled:opacity-40">
          ✓ Mark sent → next
        </button>
        <button disabled={idx >= queue.length - 1} onClick={() => setIdx((i) => i + 1)}
          className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-white disabled:opacity-30">
          Skip for now
        </button>
        <button disabled={busy} onClick={regenerate}
          title="Throw this draft away and generate a fresh one"
          className="ml-auto px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 disabled:opacity-40">
          ↻ Regenerate
        </button>
      </div>

      <p className="mt-3 text-xs text-gray-600">
        Flow: open the profile, connect (the draft's first line works as the connection note), paste the
        message once connected, then Mark sent. Replies: use Mark replied on the Leads page.
      </p>
    </div>
  );
}
