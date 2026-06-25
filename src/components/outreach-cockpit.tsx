'use client';

import { useState } from 'react';
import {
  LANES,
  LANE_ORDER,
  FRAMEWORK_INTRO,
  ROUTING_TABLE,
  SHARED_PIPELINE,
  SHARED_CORE,
  type LaneId,
} from '@/lib/outreach/lanes';
import type { OutreachWeek, DerivedStats, ComputedMetric } from '@/lib/queries/outreach-queries';

// Explicit class strings so Tailwind's scanner keeps them.
const ACCENT: Record<string, { chip: string; chipActive: string; ring: string; text: string; bar: string }> = {
  emerald: { chip: 'border-emerald-700/50 text-emerald-300', chipActive: 'bg-emerald-600 text-white border-emerald-600', ring: 'ring-emerald-500/40', text: 'text-emerald-400', bar: 'bg-emerald-500' },
  orange: { chip: 'border-orange-700/50 text-orange-300', chipActive: 'bg-orange-600 text-white border-orange-600', ring: 'ring-orange-500/40', text: 'text-orange-400', bar: 'bg-orange-500' },
  violet: { chip: 'border-violet-700/50 text-violet-300', chipActive: 'bg-violet-600 text-white border-violet-600', ring: 'ring-violet-500/40', text: 'text-violet-400', bar: 'bg-violet-500' },
  sky: { chip: 'border-sky-700/50 text-sky-300', chipActive: 'bg-sky-600 text-white border-sky-600', ring: 'ring-sky-500/40', text: 'text-sky-400', bar: 'bg-sky-500' },
};

const STATUS_BAR: Record<string, string> = {
  good: 'bg-emerald-500',
  warn: 'bg-amber-500',
  danger: 'bg-red-500',
  empty: 'bg-gray-600',
};

interface Props {
  initialLane: LaneId;
  weekStart: string;
  initialWeek: OutreachWeek;
  initialDerived: DerivedStats;
  initialMetric: ComputedMetric;
}

export function OutreachCockpit({ initialLane, weekStart, initialWeek, initialDerived, initialMetric }: Props) {
  const [lane, setLane] = useState<LaneId>(initialLane);
  const [tab, setTab] = useState<'week' | 'playbook'>('week');
  const [week, setWeek] = useState<OutreachWeek>(initialWeek);
  const [derived, setDerived] = useState<DerivedStats>(initialDerived);
  const [metric, setMetric] = useState<ComputedMetric>(initialMetric);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const def = LANES[lane];
  const accent = ACCENT[def.accent] ?? ACCENT.orange;

  async function switchLane(next: LaneId) {
    if (next === lane) return;
    setLane(next);
    // Persist active lane + load that lane's current week.
    fetch('/api/outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set-lane', lane: next }),
    }).catch(() => {});
    try {
      const res = await fetch(`/api/outreach?lane=${next}`);
      if (res.ok) {
        const data = await res.json();
        setWeek(data.week);
        setDerived(data.derived);
        setMetric(data.metric);
      }
    } catch {
      /* keep current view */
    }
  }

  async function save(patch: { metrics?: Record<string, number>; cadence?: Record<string, boolean> }) {
    setSaving(true);
    try {
      const res = await fetch('/api/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save-week', lane, weekStart, ...patch }),
      });
      if (res.ok) {
        const data = await res.json();
        setWeek(data.week);
        setDerived(data.derived);
        setMetric(data.metric);
        setSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    } finally {
      setSaving(false);
    }
  }

  function onMetricInput(key: string, raw: string) {
    const n = Math.max(0, Math.floor(Number(raw) || 0));
    setWeek((w) => ({ ...w, metrics: { ...w.metrics, [key]: n } }));
  }
  function onCadenceToggle(idx: number, checked: boolean) {
    const cadence = { ...week.cadence, [String(idx)]: checked };
    setWeek((w) => ({ ...w, cadence }));
    save({ cadence });
  }

  return (
    <div className="max-w-3xl">
      {/* Lane selector */}
      <div className="flex flex-wrap gap-2 mb-4">
        {LANE_ORDER.map((id) => {
          const a = ACCENT[LANES[id].accent] ?? ACCENT.orange;
          const active = id === lane;
          return (
            <button
              key={id}
              onClick={() => switchLane(id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${active ? a.chipActive : `bg-gray-900 hover:bg-gray-800 ${a.chip}`}`}
            >
              {LANES[id].name}
            </button>
          );
        })}
      </div>

      <div className="mb-5">
        <p className={`text-sm font-medium ${accent.text}`}>{def.archetype}</p>
        <p className="text-sm text-gray-400">{def.blurb}</p>
        <p className="text-xs text-gray-500 mt-1">{def.pairing}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-800">
        {([['week', 'My Week'], ['playbook', 'Playbook']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${tab === id ? 'border-blue-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'week' ? (
        <MyWeek
          def={def}
          accent={accent}
          week={week}
          derived={derived}
          metric={metric}
          weekStart={weekStart}
          saving={saving}
          savedAt={savedAt}
          onMetricInput={onMetricInput}
          onMetricCommit={(key, val) => save({ metrics: { [key]: val } })}
          onCadenceToggle={onCadenceToggle}
        />
      ) : (
        <Playbook def={def} accent={accent} />
      )}
    </div>
  );
}

function MyWeek({
  def,
  accent,
  week,
  derived,
  metric,
  weekStart,
  saving,
  savedAt,
  onMetricInput,
  onMetricCommit,
  onCadenceToggle,
}: {
  def: (typeof LANES)[LaneId];
  accent: (typeof ACCENT)[string];
  week: OutreachWeek;
  derived: DerivedStats;
  metric: ComputedMetric;
  weekStart: string;
  saving: boolean;
  savedAt: string | null;
  onMetricInput: (key: string, raw: string) => void;
  onMetricCommit: (key: string, val: number) => void;
  onCadenceToggle: (idx: number, checked: boolean) => void;
}) {
  const m = def.leadingMetric;
  return (
    <div className="space-y-5">
      {/* Leading metric card */}
      <div className={`rounded-xl bg-gray-900 border border-gray-800 p-5 ring-1 ${accent.ring}`}>
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-gray-500">This week’s leading metric</p>
          <p className="text-xs text-gray-500">Week of {weekStart}</p>
        </div>
        <p className="text-sm text-gray-300 mt-1">{m.label}</p>
        <div className="flex items-end gap-3 mt-2">
          <span className={`text-4xl font-bold ${metric.status === 'danger' ? 'text-red-400' : accent.text}`}>{metric.display}</span>
          <span className="text-sm text-gray-400 mb-1">target: {metric.target}</span>
        </div>
        <div className="mt-3 h-1.5 w-full rounded-full bg-gray-800 overflow-hidden">
          <div className={`h-full ${STATUS_BAR[metric.status]}`} style={{ width: `${Math.round(metric.progress * 100)}%` }} />
        </div>
        <p className="text-xs text-gray-400 mt-2">{metric.detail}</p>

        {/* Manual inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          {m.inputs.map((inp) => (
            <label key={inp.key} className="text-sm">
              <span className="block text-gray-400 mb-1">{inp.label}</span>
              <input
                type="number"
                min={0}
                value={week.metrics[inp.key] ?? 0}
                onChange={(e) => onMetricInput(inp.key, e.target.value)}
                onBlur={(e) => onMetricCommit(inp.key, Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </label>
          ))}
        </div>
        {m.ratioAgainst === 'discoveryDone' && (
          <p className="text-xs text-gray-500 mt-2">Auto-derived from your pipeline: {derived.discoveryDone} discovery call(s) completed this week.</p>
        )}
        <p className="text-xs text-gray-500 mt-2">{saving ? 'Saving…' : savedAt ? `Saved ${savedAt}` : 'Edits save automatically.'}</p>
      </div>

      {/* Dry-well — armed, and highlighted when the metric crosses the danger line */}
      <div className={`rounded-xl border p-5 ${metric.dangerTriggered ? 'border-red-700 bg-red-950/30' : 'border-gray-800 bg-gray-900'}`}>
        <div className="flex items-center gap-2">
          <span className={metric.dangerTriggered ? 'text-red-400' : 'text-gray-500'}>{metric.dangerTriggered ? '⚠' : '◷'}</span>
          <h3 className="text-sm font-semibold text-white">Dry-well protocol</h3>
          <span className={`text-xs ${metric.dangerTriggered ? 'text-red-400' : 'text-gray-500'}`}>
            {metric.dangerTriggered ? 'TRIGGERED' : 'armed'}
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-1">{metric.dangerTriggered ? metric.dangerLabel : def.dryWellIntro}</p>
        <ol className="mt-3 space-y-2">
          {def.dryWell.map((step, i) => (
            <li key={i} className="flex gap-2 text-sm text-gray-300">
              <span className="text-gray-500">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Weekly cadence checklist */}
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Weekly cadence</h3>
        <ul className="space-y-2">
          {def.weeklyCadence.map((item, i) => {
            const checked = Boolean(week.cadence[String(i)]);
            return (
              <li key={i}>
                <label className="flex items-start gap-3 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onCadenceToggle(i, e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-600 bg-gray-950 accent-blue-600"
                  />
                  <span className={checked ? 'text-gray-500 line-through' : 'text-gray-300'}>{item}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Playbook({ def, accent }: { def: (typeof LANES)[LaneId]; accent: (typeof ACCENT)[string] }) {
  const m = def.leadingMetric;
  return (
    <div className="space-y-6 text-sm">
      {/* This lane */}
      <section className="rounded-xl bg-gray-900 border border-gray-800 p-5">
        <h3 className={`text-base font-semibold ${accent.text}`}>{def.name} — operating plan</h3>
        <div className="mt-3 space-y-4">
          <Block title="Leading metric">
            <p className="text-gray-200 font-medium">{m.label}</p>
            <p className="text-gray-400 mt-1">{m.definition}</p>
          </Block>
          <Block title="Weekly cadence">
            <ul className="list-disc pl-5 space-y-1 text-gray-300">
              {def.weeklyCadence.map((x, i) => <li key={i}>{x}</li>)}
            </ul>
          </Block>
          <Block title="Dry-well protocol">
            <p className="text-gray-400 mb-2">{def.dryWellIntro}</p>
            <ol className="list-decimal pl-5 space-y-1 text-gray-300">
              {def.dryWell.map((x, i) => <li key={i}>{x}</li>)}
            </ol>
          </Block>
          <Block title="GHL layer">
            <ul className="list-disc pl-5 space-y-1 text-gray-300">
              {def.ghlLayer.map((x, i) => <li key={i}>{x}</li>)}
            </ul>
          </Block>
        </div>
      </section>

      {/* Framework + routing */}
      <section className="rounded-xl bg-gray-900 border border-gray-800 p-5">
        <h3 className="text-base font-semibold text-white">{FRAMEWORK_INTRO.title}</h3>
        <p className="text-gray-400 mt-2">{FRAMEWORK_INTRO.tagline}</p>
        <p className="text-gray-400 mt-2">{FRAMEWORK_INTRO.routingRule}</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-gray-500">
              <tr>
                <th className="py-1 pr-3 font-medium">Primary lane</th>
                <th className="py-1 pr-3 font-medium">Eats solo?</th>
                <th className="py-1 pr-3 font-medium">Companion</th>
                <th className="py-1 font-medium">When</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              {ROUTING_TABLE.map((r) => (
                <tr key={r.lane} className="border-t border-gray-800">
                  <td className="py-1.5 pr-3">{r.lane}</td>
                  <td className="py-1.5 pr-3">{r.solo}</td>
                  <td className="py-1.5 pr-3">{r.companion}</td>
                  <td className="py-1.5">{r.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Shared core */}
      <section className="rounded-xl bg-gray-900 border border-gray-800 p-5">
        <h3 className="text-base font-semibold text-white">The shared core (all four lanes)</h3>
        <p className="text-gray-400 mt-2">{SHARED_CORE.pipelineNote}</p>
        <Block title="The one pipeline">
          <ol className="space-y-1 text-gray-300">
            {SHARED_PIPELINE.map((s, i) => (
              <li key={s.stage}><span className="text-gray-500">{i + 1}.</span> <span className="font-medium">{s.stage}</span> — <span className="text-gray-400">{s.note}</span></li>
            ))}
          </ol>
        </Block>
        <Block title="Universal tags & fields">
          <ul className="list-disc pl-5 space-y-1 text-gray-300">
            {SHARED_CORE.universalTags.map((x, i) => <li key={i}>{x}</li>)}
          </ul>
        </Block>
        <Block title="The universal referral ask">
          <p className="text-gray-400">{SHARED_CORE.referralAsk}</p>
        </Block>
        <Block title="The tracking discipline">
          <p className="text-gray-400">{SHARED_CORE.trackingDiscipline}</p>
        </Block>
      </section>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">{title}</p>
      {children}
    </div>
  );
}
