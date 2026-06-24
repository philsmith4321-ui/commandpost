'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import type { KbDocument, KbSourceType } from '@/lib/types';

type KbListItem = Omit<KbDocument, 'content'>;
interface KbStats { count: number; chars: number }

const TYPE_BADGE: Record<KbSourceType, string> = {
  website: 'bg-blue-600/20 text-blue-400',
  pdf: 'bg-green-600/20 text-green-400',
  html: 'bg-orange-600/20 text-orange-400',
  text: 'bg-purple-600/20 text-purple-400',
  book: 'bg-green-600/20 text-green-400',
};

function fmtChars(n: number): string {
  if (n < 1000) return `${n} chars`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k chars`;
  return `${(n / 1_000_000).toFixed(1)}M chars`;
}

export function IngestionHub({
  initialDocuments,
  initialStats,
}: {
  initialDocuments: KbListItem[];
  initialStats: KbStats;
}) {
  const [docs, setDocs] = useState<KbListItem[]>(initialDocuments);
  const [stats, setStats] = useState<KbStats>(initialStats);
  const [query, setQuery] = useState('');

  const refresh = useCallback(async (q = '') => {
    const res = await fetch(`/api/ingestion/kb?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      setDocs(data.documents);
      setStats(data.stats);
    }
  }, []);

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AudioVideoCard />
        <WebsiteCard onIngested={() => refresh(query)} />
        <FileCard
          kind="document"
          onIngested={() => refresh(query)}
        />
        <FileCard kind="html" onIngested={() => refresh(query)} />
        <PasteTextCard onIngested={() => refresh(query)} />
      </div>

      <KnowledgeBase docs={docs} stats={stats} query={query} setQuery={setQuery} refresh={refresh} />
    </div>
  );
}

/* ---------------- Card shell ---------------- */

function Card({
  icon,
  iconBg,
  title,
  desc,
  children,
  footer,
}: {
  icon: string;
  iconBg: string;
  title: string;
  desc: string;
  children: React.ReactNode;
  footer?: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col">
      <div className="flex items-start gap-3 mb-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${iconBg}`}>{icon}</div>
        <div>
          <h3 className="text-lg font-bold leading-tight">{title}</h3>
          <p className="text-sm text-gray-400 mt-0.5">{desc}</p>
        </div>
      </div>
      <div className="mt-auto space-y-2">{children}</div>
      {footer && <p className="text-xs text-gray-500 mt-3">{footer}</p>}
    </div>
  );
}

function Msg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return <p className={`text-sm mt-2 ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</p>;
}

/* ---------------- Audio / Video → Video library ---------------- */

function AudioVideoCard() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function upload() {
    if (!file) { setMsg({ ok: false, text: 'Choose a file first.' }); return; }
    setBusy(true); setMsg(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('title', title.trim() || file.name.replace(/\.[^.]+$/, ''));
      form.append('type', 'podcast');
      const res = await fetch('/api/content/video/upload', { method: 'POST', body: form });
      if (!res.ok) { setMsg({ ok: false, text: (await res.json()).error || 'Upload failed' }); return; }
      setFile(null); setTitle('');
      setMsg({ ok: true, text: 'Uploaded — transcribing & extracting clips in the Video library.' });
    } catch {
      setMsg({ ok: false, text: 'Upload failed. Try again.' });
    } finally { setBusy(false); }
  }

  return (
    <Card icon="🎞" iconBg="bg-blue-600" title="Audio / Video"
      desc="Transcribe & auto-extract short-form clips. Saves to the Video library."
      footer="→ Video library · transcribe + clips">
      <div className="flex items-center gap-2">
        <label className="inline-block">
          <span className="inline-block px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm cursor-pointer transition-colors">
            {file ? 'Change…' : 'Browse…'}
          </span>
          <input type="file" accept=".mp3,.wav,.m4a,.aac,.mp4,.mov,.webm,.ogg,.flac" className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <span className="text-xs text-gray-500 truncate">{file ? file.name : 'No file selected.'}</span>
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Content title…"
        className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none" />
      <button onClick={upload} disabled={busy}
        className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
        {busy ? 'Uploading…' : 'Upload & Process'}
      </button>
      <Link href="/content/video" className="block text-center text-xs text-blue-400 hover:underline">Open Video library →</Link>
      <Msg msg={msg} />
    </Card>
  );
}

/* ---------------- Website → KB ---------------- */

function WebsiteCard({ onIngested }: { onIngested: () => void }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function ingest() {
    if (!url.trim()) { setMsg({ ok: false, text: 'Enter a URL.' }); return; }
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/ingestion/website', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg({ ok: false, text: data.error || 'Ingest failed' }); return; }
      setUrl('');
      setMsg({ ok: true, text: `Ingested “${data.title}” (${fmtChars(data.char_count)}).` });
      onIngested();
    } catch {
      setMsg({ ok: false, text: 'Ingest failed. Try again.' });
    } finally { setBusy(false); }
  }

  return (
    <Card icon="🌐" iconBg="bg-blue-600" title="Website"
      desc="Scrape a page's article text into the knowledge base."
      footer="→ Knowledge base">
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/article"
        className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none" />
      <button onClick={ingest} disabled={busy}
        className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
        {busy ? 'Scraping…' : 'Ingest Website'}
      </button>
      <Msg msg={msg} />
    </Card>
  );
}

/* ---------------- File (PDF/doc or HTML) → KB ---------------- */

function FileCard({ kind, onIngested }: { kind: 'document' | 'html'; onIngested: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  const isDoc = kind === 'document';
  const accept = isDoc ? '.pdf,.txt,.md' : '.html,.htm';

  async function ingest() {
    if (!file) { setMsg({ ok: false, text: 'Choose a file first.' }); return; }
    setBusy(true); setMsg(null);
    try {
      const form = new FormData();
      form.append('file', file);
      if (title.trim()) form.append('title', title.trim());
      const res = await fetch('/api/ingestion/file', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) { setMsg({ ok: false, text: data.error || 'Ingest failed' }); return; }
      setFile(null); setTitle(''); if (ref.current) ref.current.value = '';
      setMsg({ ok: true, text: `Ingested “${data.title}” (${fmtChars(data.char_count)}).` });
      onIngested();
    } catch {
      setMsg({ ok: false, text: 'Ingest failed. Try again.' });
    } finally { setBusy(false); }
  }

  return (
    <Card
      icon={isDoc ? '📖' : '📄'}
      iconBg={isDoc ? 'bg-green-600' : 'bg-orange-600'}
      title={isDoc ? 'Document / PDF' : 'HTML File'}
      desc={isDoc
        ? 'Upload a PDF, .txt, or .md — text is extracted automatically.'
        : 'Upload an HTML file — scripts, styles & nav are stripped out.'}
      footer="→ Knowledge base"
    >
      <div className="flex items-center gap-2">
        <label className="inline-block">
          <span className="inline-block px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm cursor-pointer transition-colors">
            {file ? 'Change…' : 'Browse…'}
          </span>
          <input ref={ref} type="file" accept={accept} className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <span className="text-xs text-gray-500 truncate">{file ? file.name : 'No file selected.'}</span>
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)…"
        className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none" />
      <button onClick={ingest} disabled={busy}
        className={`w-full py-2.5 rounded-lg disabled:opacity-50 text-white text-sm font-medium transition-colors ${
          isDoc ? 'bg-green-600 hover:bg-green-500' : 'bg-orange-600 hover:bg-orange-500'
        }`}>
        {busy ? 'Ingesting…' : 'Upload & Ingest'}
      </button>
      <Msg msg={msg} />
    </Card>
  );
}

/* ---------------- Paste Text → KB ---------------- */

function PasteTextCard({ onIngested }: { onIngested: () => void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function ingest() {
    if (!content.trim()) { setMsg({ ok: false, text: 'Paste some text first.' }); return; }
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/ingestion/text', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg({ ok: false, text: data.error || 'Ingest failed' }); return; }
      setTitle(''); setContent('');
      setMsg({ ok: true, text: `Ingested (${fmtChars(data.char_count)}).` });
      onIngested();
    } catch {
      setMsg({ ok: false, text: 'Ingest failed. Try again.' });
    } finally { setBusy(false); }
  }

  return (
    <Card icon="✎" iconBg="bg-purple-600" title="Paste Text"
      desc="Paste any text or transcript straight into the knowledge base."
      footer="→ Knowledge base">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)…"
        className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-purple-500 focus:outline-none" />
      <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} placeholder="Paste text here…"
        className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-purple-500 focus:outline-none" />
      <button onClick={ingest} disabled={busy}
        className="w-full py-2.5 rounded-lg bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white text-sm font-medium transition-colors">
        {busy ? 'Ingesting…' : 'Ingest Text'}
      </button>
      <Msg msg={msg} />
    </Card>
  );
}

/* ---------------- Knowledge Base browser ---------------- */

function KnowledgeBase({
  docs, stats, query, setQuery, refresh,
}: {
  docs: KbListItem[];
  stats: KbStats;
  query: string;
  setQuery: (v: string) => void;
  refresh: (q?: string) => Promise<void>;
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [openContent, setOpenContent] = useState<string>('');

  async function view(id: number) {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id); setOpenContent('Loading…');
    const res = await fetch(`/api/ingestion/kb/${id}`);
    setOpenContent(res.ok ? (await res.json()).content : 'Failed to load.');
  }

  async function remove(id: number) {
    if (!confirm('Delete this knowledge-base document?')) return;
    await fetch(`/api/ingestion/kb/${id}`, { method: 'DELETE' });
    if (openId === id) setOpenId(null);
    refresh(query);
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h3 className="text-lg font-bold">Knowledge Base</h3>
          <p className="text-sm text-gray-400">{stats.count} document{stats.count === 1 ? '' : 's'} · {fmtChars(stats.chars)}</p>
        </div>
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); refresh(e.target.value); }}
          placeholder="Search…"
          className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none w-56"
        />
      </div>

      {docs.length === 0 ? (
        <p className="text-sm text-gray-500">{query ? 'No matches.' : 'Nothing ingested yet. Use a card above.'}</p>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <div key={d.id} className="rounded-lg border border-gray-800 bg-gray-950/40">
              <div className="flex items-center justify-between gap-3 p-3">
                <button onClick={() => view(d.id)} className="min-w-0 text-left flex-1">
                  <p className="font-medium text-white truncate">{d.title}</p>
                  <p className="text-xs text-gray-500">
                    <span className={`px-1.5 py-0.5 rounded ${TYPE_BADGE[d.source_type]}`}>{d.source_type}</span>
                    {' · '}{fmtChars(d.char_count)}{' · '}{d.created_at}
                    {d.source_url ? ` · ${d.source_url}` : ''}
                  </p>
                </button>
                <button onClick={() => remove(d.id)}
                  className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-red-900/40 text-xs text-gray-400 hover:text-red-300 transition-colors shrink-0">
                  Delete
                </button>
              </div>
              {openId === d.id && (
                <pre className="px-3 pb-3 text-xs text-gray-400 whitespace-pre-wrap max-h-72 overflow-y-auto font-sans">{openContent}</pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
