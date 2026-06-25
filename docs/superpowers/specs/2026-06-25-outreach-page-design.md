# Outreach Page — Design Spec

**Date:** 2026-06-25
**Status:** Approved, building
**Source data:** "The Four Lanes — Operating Plans" (RekindleLeads · AI Agency Operator Training)

## Goal

Add an `/outreach` page to CommandPost that turns the Four Lanes framework into a working
single-operator (Phil) tool: a **Playbook** (reference) + a **My Week** tracker that watches
the one leading metric per lane, the weekly cadence, and the dry-well protocol.

## Scope

- **In:** Two-tab page (My Week + Playbook), lane selector, leading-metric card (part
  auto-derived from real lead data, part one-tap manual), weekly cadence checklist, dry-well
  protocol panel, structured Four Lanes content.
- **Out (v1):** live GHL placement quiz, multi-operator/resellable lane state, automation
  script libraries. (These are the framework's own "what's still open" items.)

## The Four Lanes (structured content)

`src/lib/outreach/lanes.ts` holds the framework as structured TS data so both tabs reuse it:
shared pipeline stages, universal tags, the referral-ask rule, and per lane —
`leadingMetric` (label, definition, target band, danger threshold, derivation hints),
`weeklyCadence[]`, `dryWell[]` steps, `ghlLayer[]` notes, plus the framework intro and
routing rule. Lanes: `connector`, `hunter`, `broadcaster`, `magnet`.

Leading metrics:
- **Connector** — referral asks made / week (target ≈ 1:1 with Discovery Done).
- **Hunter** — reply rate on pain-led outreach (target 8–12%; danger < 5%).
- **Broadcaster** — publishing consistency × CTA responses (3x/week, every post a CTA).
- **Magnet** — distribution seeded → qualified tool completions → calls.

## Data model (additive migrations, avatar-style)

1. `ALTER TABLE leads ADD COLUMN lane TEXT` — nullable door attribution
   (connector/hunter/broadcaster/magnet). Lets the tracker auto-derive per-lane counts.
2. `CREATE TABLE outreach_week` — one row per (ISO Monday week_start, lane):
   - `week_start TEXT`, `lane TEXT`, `metrics TEXT DEFAULT '{}'` (JSON: lane-specific manual
     counters — sends, replies, referral_asks, posts, cta_responses, distribution,
     completions), `cadence TEXT DEFAULT '{}'` (JSON: checkbox state keyed by cadence index),
     `updated_at`. `UNIQUE(week_start, lane)`.
3. Active lane stored in existing `app_settings` under key `outreach_active_lane`.

**Auto-derivation** (`deriveWeekStats`): from `lead_stage_history` timestamps within the
week window, filtered by `leads.lane` — outreaches = entries into `contacted`,
discovery-done = entries into `discovery`, won = entries into `won`. Manual counters cover
what the schema can't see (replies, referral asks, posts). Metric value = blend of the two.

## Surfaces

- `src/lib/queries/outreach-queries.ts` — getActiveLane/setActiveLane, getWeek, upsertWeek,
  deriveWeekStats, computeMetric (returns value/target/status/dangerTriggered).
- `src/app/(dashboard)/outreach/page.tsx` — server component; loads active lane, current
  Monday week_start, week row, derived stats; renders the cockpit.
- `src/components/outreach-cockpit.tsx` — client; lane selector, tabs, metric card, cadence
  checklist, dry-well panel, Playbook renderer. Persists via the API route.
- `src/app/api/outreach/route.ts` — GET (lane+week+derived), POST (set lane / save
  metrics+cadence).
- `src/components/sidebar.tsx` + `src/components/mobile-nav.tsx` — add Outreach nav link.

## Conventions

- Modified Next.js 16 (see AGENTS.md) — consult `node_modules/next/dist/docs/` before coding.
- Match existing patterns: `getDb()`, query fns `(db, ...)`, `export const dynamic =
  'force-dynamic'`, server component + client component + API route split, Tailwind dark theme.

## Success criteria

- `/outreach` reachable from sidebar; lane selector persists.
- Playbook tab renders all four lanes + shared core accurately from the source doc.
- My Week tab shows the active lane's leading metric with target band, a cadence checklist
  that persists for the week, and a dry-well panel that highlights when the metric crosses
  the danger threshold.
- `npm run build` and `npm test` pass.
