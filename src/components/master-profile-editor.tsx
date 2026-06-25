'use client';

import { useState } from 'react';
import type { MasterProfile, MasterObjection } from '@/lib/types';

function linesToArray(s: string): string[] {
  return s.split('\n').map((x) => x.trim()).filter(Boolean);
}
function arrayToLines(a: string[]): string { return a.join('\n'); }
function objectionsToText(o: MasterObjection[]): string {
  return o.map((x) => `${x.objection} :: ${x.counter}`).join('\n');
}
function textToObjections(s: string): MasterObjection[] {
  return linesToArray(s).map((line) => {
    const [objection, counter = ''] = line.split('::').map((p) => p.trim());
    return { objection, counter };
  }).filter((o) => o.objection);
}

export function MasterProfileEditor({ initialMaster }: { initialMaster: MasterProfile | null }) {
  const [identity, setIdentity] = useState(initialMaster?.identity ?? '');
  const [wants, setWants] = useState(initialMaster?.wants ?? '');
  const [burnedBy, setBurnedBy] = useState(initialMaster?.burned_by ?? '');
  const [buyingTrigger, setBuyingTrigger] = useState(initialMaster?.buying_trigger ?? '');
  const [tone, setTone] = useState(initialMaster?.tone ?? '');
  const [trustBuilders, setTrustBuilders] = useState(arrayToLines(initialMaster?.trust_builders ?? []));
  const [objections, setObjections] = useState(objectionsToText(initialMaster?.objections ?? []));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true); setSaved(false);
    try {
      const res = await fetch('/api/master', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identity, wants, burned_by: burnedBy, buying_trigger: buyingTrigger, tone,
          trust_builders: linesToArray(trustBuilders),
          objections: textToObjections(objections),
        }),
      });
      if (res.ok) setSaved(true);
    } finally { setBusy(false); }
  }

  const ta = 'w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-pink-500 focus:outline-none';
  const lbl = 'block text-xs text-gray-400 mb-1';

  return (
    <div className="bg-gray-900 border border-pink-600/40 rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Master Profile — &ldquo;The Owner Who Built It&rdquo;</h3>
        <span className="text-xs text-gray-500">Always applied to every piece</span>
      </div>
      <div><label className={lbl}>Core identity</label>
        <textarea className={ta} rows={3} value={identity} onChange={(e) => setIdentity(e.target.value)} /></div>
      <div><label className={lbl}>What they actually want</label>
        <textarea className={ta} rows={2} value={wants} onChange={(e) => setWants(e.target.value)} /></div>
      <div><label className={lbl}>How they&rsquo;ve been burned</label>
        <textarea className={ta} rows={2} value={burnedBy} onChange={(e) => setBurnedBy(e.target.value)} /></div>
      <div><label className={lbl}>Universal buying trigger</label>
        <textarea className={ta} rows={2} value={buyingTrigger} onChange={(e) => setBuyingTrigger(e.target.value)} /></div>
      <div><label className={lbl}>Tone for all content</label>
        <textarea className={ta} rows={2} value={tone} onChange={(e) => setTone(e.target.value)} /></div>
      <div><label className={lbl}>What earns their trust — one per line</label>
        <textarea className={ta} rows={4} value={trustBuilders} onChange={(e) => setTrustBuilders(e.target.value)} /></div>
      <div><label className={lbl}>Universal objections — one per line, format: <code>objection :: counter</code></label>
        <textarea className={ta} rows={6} value={objections} onChange={(e) => setObjections(e.target.value)} /></div>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy}
          className="px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
          {busy ? 'Saving…' : 'Save Master Profile'}
        </button>
        {saved && <span className="text-xs text-green-400">Saved</span>}
      </div>
    </div>
  );
}
