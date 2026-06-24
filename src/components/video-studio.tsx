'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MediaItemWithClips, MediaType, MediaStatus } from '@/lib/types';

const MEDIA_TYPES: MediaType[] = ['podcast', 'radio', 'video', 'interview', 'other'];
const ACCEPT = '.mp3,.wav,.m4a,.aac,.mp4,.mov,.webm,.ogg,.flac';
const ACTIVE: MediaStatus[] = ['queued', 'transcribing', 'extracting'];

function fmtTime(s: number): string {
  if (!s || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function fmtBytes(b: number): string {
  if (!b) return '';
  if (b < 1024 * 1024) return (b / 1024).toFixed(0) + ' KB';
  if (b < 1024 * 1024 * 1024) return (b / (1024 * 1024)).toFixed(1) + ' MB';
  return (b / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

const STATUS_LABEL: Record<MediaStatus, string> = {
  queued: 'Queued',
  transcribing: 'Transcribing…',
  extracting: 'Finding clips…',
  ready: 'Ready',
  error: 'Error',
};

function StatusBadge({ status }: { status: MediaStatus }) {
  const styles: Record<MediaStatus, string> = {
    queued: 'bg-gray-700 text-gray-300',
    transcribing: 'bg-amber-600/20 text-amber-400',
    extracting: 'bg-blue-600/20 text-blue-400',
    ready: 'bg-green-600/20 text-green-400',
    error: 'bg-red-600/20 text-red-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function VideoStudio({ initialItems }: { initialItems: MediaItemWithClips[] }) {
  const [items, setItems] = useState<MediaItemWithClips[]>(initialItems);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/content/video/items', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items as MediaItemWithClips[]);
      }
    } catch {
      /* ignore transient errors */
    }
  }, []);

  // Poll while anything is still processing.
  useEffect(() => {
    const anyActive = items.some((i) => ACTIVE.includes(i.status));
    if (!anyActive) return;
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [items, refresh]);

  return (
    <div className="space-y-6 max-w-5xl">
      <RadioVideoEdits onChanged={refresh} />
      <UploadProcess onChanged={refresh} />
      <MediaLibrary items={items} onChanged={refresh} />
    </div>
  );
}

/* ---------------- Card 1: Radio/Video Edits (Upload File / Paste Transcript) ---------------- */

function RadioVideoEdits({ onChanged }: { onChanged: () => void }) {
  const [tab, setTab] = useState<'upload' | 'transcript'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState('');
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function extract() {
    setBusy(true);
    setMsg(null);
    try {
      if (tab === 'upload') {
        if (!file) { setMsg('Choose a file first.'); return; }
        const form = new FormData();
        form.append('file', file);
        form.append('title', file.name.replace(/\.[^.]+$/, ''));
        form.append('type', 'podcast');
        const res = await fetch('/api/content/video/upload', { method: 'POST', body: form });
        if (!res.ok) { setMsg((await res.json()).error || 'Upload failed'); return; }
        setFile(null);
        setMsg('Uploaded — transcribing & finding clips. Watch the library below.');
      } else {
        if (!transcript.trim()) { setMsg('Paste a transcript first.'); return; }
        const res = await fetch('/api/content/video/extract-shorts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript, title: 'Pasted transcript', type: 'podcast' }),
        });
        if (!res.ok) { setMsg((await res.json()).error || 'Extraction failed'); return; }
        setTranscript('');
        setMsg('Clips extracted — see the library below.');
      }
      onChanged();
    } catch {
      setMsg('Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-6">
      <div className="grid grid-cols-2 gap-2 mb-5">
        <button
          onClick={() => setTab('upload')}
          className={`py-3 rounded-lg text-sm font-medium transition-colors ${
            tab === 'upload' ? 'bg-gray-700 text-white' : 'bg-gray-800/50 text-gray-400 hover:text-white'
          }`}
        >
          ⬆ Upload File
        </button>
        <button
          onClick={() => setTab('transcript')}
          className={`py-3 rounded-lg text-sm font-medium transition-colors ${
            tab === 'transcript' ? 'bg-gray-700 text-white' : 'bg-gray-800/50 text-gray-400 hover:text-white'
          }`}
        >
          Paste Transcript
        </button>
      </div>

      {tab === 'upload' ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) setFile(f);
          }}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
            dragging ? 'border-purple-500 bg-purple-500/5' : 'border-gray-700 hover:border-gray-600'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <div className="text-3xl text-gray-500 mb-2">⬆</div>
          {file ? (
            <p className="text-white font-medium">{file.name} <span className="text-gray-500">({fmtBytes(file.size)})</span></p>
          ) : (
            <p className="text-gray-300">Drag &amp; drop a file here, or click to browse</p>
          )}
          <p className="text-xs text-gray-500 mt-1">MP3, WAV, M4A, AAC, MP4, MOV, WebM · Up to 1.2 GB</p>
        </div>
      ) : (
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          rows={8}
          placeholder="Paste a transcript here to extract short-form clip ideas…"
          className="w-full rounded-xl bg-gray-950 border border-gray-700 p-3 text-sm text-white placeholder-gray-600 focus:border-purple-500 focus:outline-none"
        />
      )}

      <button
        onClick={extract}
        disabled={busy}
        className="mt-4 w-full py-3.5 rounded-xl bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white font-semibold transition-colors"
      >
        {busy ? 'Working…' : '✂ Extract Shorts'}
      </button>
      {msg && <p className="mt-3 text-sm text-gray-400">{msg}</p>}
    </div>
  );
}

/* ---------------- Card 2: Upload Audio / Video (titled, with type) ---------------- */

function UploadProcess({ onChanged }: { onChanged: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<MediaType>('podcast');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function upload() {
    if (!file) { setMsg('Choose a file first.'); return; }
    setBusy(true);
    setMsg(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('title', title.trim() || file.name.replace(/\.[^.]+$/, ''));
      form.append('type', type);
      const res = await fetch('/api/content/video/upload', { method: 'POST', body: form });
      if (!res.ok) { setMsg((await res.json()).error || 'Upload failed'); return; }
      setFile(null);
      setTitle('');
      setMsg('Uploaded — transcribing with Whisper & saving to your library.');
      onChanged();
    } catch {
      setMsg('Upload failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-lg">🎞</div>
        <div>
          <h3 className="text-lg font-bold">Upload Audio / Video</h3>
          <p className="text-sm text-gray-400">Transcribe with Whisper, auto-extract short clip suggestions, and save to your library</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr_auto_auto] gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">File</label>
          <label className="block">
            <span className="inline-block px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm cursor-pointer transition-colors">
              {file ? 'Change…' : 'Browse…'}
            </span>
            <input type="file" accept={ACCEPT} className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <span className="ml-2 text-xs text-gray-500">{file ? file.name : 'No file selected.'}</span>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Content title…"
            className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as MediaType)}
            className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none capitalize"
          >
            {MEDIA_TYPES.map((t) => (
              <option key={t} value={t} className="capitalize">{t}</option>
            ))}
          </select>
        </div>
        <button
          onClick={upload}
          disabled={busy}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors h-[38px]"
        >
          {busy ? 'Uploading…' : 'Upload & Process'}
        </button>
      </div>
      {msg && <p className="mt-3 text-sm text-gray-400">{msg}</p>}
    </div>
  );
}

/* ---------------- Card 3: Media Library ---------------- */

function MediaLibrary({ items, onChanged }: { items: MediaItemWithClips[]; onChanged: () => void }) {
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-6">
      <button onClick={() => setOpen((o) => !o)} className="flex items-start gap-3 w-full text-left">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-lg">📚</div>
        <div className="flex-1">
          <h3 className="text-lg font-bold">Media Library</h3>
          <p className="text-sm text-gray-400">Click to expand, review clips, and cut videos</p>
        </div>
        <span className="text-gray-500 text-sm mt-1">{items.length} item{items.length === 1 ? '' : 's'} {open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-2">
          {items.length === 0 ? (
            <p className="text-gray-500 text-sm">No media yet. Upload a file or paste a transcript above.</p>
          ) : (
            items.map((item) => (
              <LibraryRow
                key={item.id}
                item={item}
                expanded={expanded.has(item.id)}
                onToggle={() => toggle(item.id)}
                onChanged={onChanged}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function LibraryRow({
  item,
  expanded,
  onToggle,
  onChanged,
}: {
  item: MediaItemWithClips;
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const [cutting, setCutting] = useState<Set<number>>(new Set());

  async function cut(clipId: number) {
    setCutting((p) => new Set(p).add(clipId));
    try {
      const res = await fetch(`/api/content/video/clips/${clipId}/cut`, { method: 'POST' });
      if (!res.ok) alert((await res.json()).error || 'Cut failed');
      onChanged();
    } finally {
      setCutting((p) => { const n = new Set(p); n.delete(clipId); return n; });
    }
  }

  async function remove() {
    if (!confirm(`Delete "${item.title}" and its clips?`)) return;
    await fetch(`/api/content/video/${item.id}`, { method: 'DELETE' });
    onChanged();
  }

  async function reExtract() {
    await fetch(`/api/content/video/${item.id}/extract`, { method: 'POST' });
    onChanged();
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950/40">
      <button onClick={onToggle} className="flex items-center justify-between w-full p-3 text-left gap-3">
        <div className="min-w-0">
          <p className="font-medium text-white truncate">{item.title}</p>
          <p className="text-xs text-gray-500 capitalize">
            {item.media_type} · {item.source}
            {item.duration_seconds ? ` · ${fmtTime(item.duration_seconds)}` : ''}
            {item.clips.length ? ` · ${item.clips.length} clip${item.clips.length === 1 ? '' : 's'}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={item.status} />
          <span className="text-gray-500 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {item.status === 'error' && item.error && (
            <p className="text-sm text-red-400">⚠ {item.error}</p>
          )}

          {item.filename && (
            <video
              controls
              preload="metadata"
              src={`/api/content/video/file/${item.filename}`}
              className="w-full max-h-64 rounded-lg bg-black"
            />
          )}

          <div className="flex flex-wrap gap-2">
            {item.transcript && (
              <button onClick={reExtract} className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs transition-colors">
                Re-find clips
              </button>
            )}
            <button onClick={remove} className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-red-900/40 text-xs text-gray-400 hover:text-red-300 transition-colors">
              Delete
            </button>
          </div>

          {item.clips.length === 0 ? (
            <p className="text-sm text-gray-500">
              {ACTIVE.includes(item.status) ? 'Processing…' : 'No clips suggested.'}
            </p>
          ) : (
            <div className="space-y-2">
              {item.clips.map((c) => (
                <div key={c.id} className="rounded-lg border border-gray-800 bg-gray-900 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-white text-sm">{c.title}</p>
                      {(c.end_seconds > 0 || c.start_seconds > 0) && (
                        <p className="text-xs text-purple-400">{fmtTime(c.start_seconds)} – {fmtTime(c.end_seconds)} ({Math.round(c.end_seconds - c.start_seconds)}s)</p>
                      )}
                    </div>
                    <div className="shrink-0">
                      {c.clip_filename ? (
                        <a
                          href={`/api/content/video/file/${c.clip_filename}`}
                          download
                          className="px-3 py-1.5 rounded-lg bg-green-600/20 text-green-400 text-xs font-medium hover:bg-green-600/30 transition-colors"
                        >
                          ⬇ Download
                        </a>
                      ) : item.filename && c.end_seconds > c.start_seconds ? (
                        <button
                          onClick={() => cut(c.id)}
                          disabled={cutting.has(c.id)}
                          className="px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white text-xs font-medium transition-colors"
                        >
                          {cutting.has(c.id) ? 'Cutting…' : '✂ Cut clip'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {c.reason && <p className="text-xs text-gray-500 mt-1.5">💡 {c.reason}</p>}
                  {c.transcript_excerpt && (
                    <p className="text-xs text-gray-400 mt-1.5 line-clamp-3 whitespace-pre-wrap">{c.transcript_excerpt}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
