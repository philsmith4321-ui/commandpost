# Outreach Auto-Draft + 4-Channel — Design & Build Contract

**Date:** 2026-06-25
**Status:** Approved, building.

## Goal

On the Outreach → Leads tab, let the user (Phil Smith / RekindleLeads) auto-draft
personalized cold outreach per lead, across four channels, and track send/unsend for
each. Drafts are AI-generated, editable, copied out, and sent manually — **nothing
sends automatically from the app.**

## Channels

Outreach now has **four draftable channels**: `letter`, `email`, `linkedin`, `fb`
(Facebook Messenger). `phone` remains a logged-call action only (no draft, no toggle
change). Each of the four gets: a send/unsend toggle, a clickable status badge, and an
auto-draft button.

## Layers & file ownership (disjoint — no two agents share a file)

### Agent 1 — Data & migration
- `src/lib/types.ts`: `OutreachChannel = 'letter' | 'email' | 'phone' | 'linkedin' | 'fb'`.
- `src/lib/db.ts`: two idempotent migrations appended to the migration section in `initDb`
  (follow the existing `pragma_table_info` guard pattern):
  1. **Rebuild `outreach_touches`** so `CHECK(channel IN (...))` includes `'linkedin','fb'`.
     SQLite can't alter a CHECK, so rebuild the table. Guard on whether the table's
     `sql` in `sqlite_master` already contains `'linkedin'`. Steps: `pragma foreign_keys=OFF`,
     run a transaction that creates `outreach_touches_new` (same columns, expanded CHECK:
     `CHECK(channel IN ('letter','email','phone','linkedin','fb'))`), `INSERT INTO
     outreach_touches_new SELECT * FROM outreach_touches`, `DROP TABLE outreach_touches`,
     `ALTER TABLE outreach_touches_new RENAME TO outreach_touches`, recreate
     `idx_outreach_touches_lead`; then `pragma foreign_keys=ON`.
  2. **Add draft columns to `leads`**: `draft_letter`, `draft_email`, `draft_linkedin`,
     `draft_fb`, each `TEXT`, via guarded `ALTER TABLE leads ADD COLUMN`.
- `src/lib/queries/outreach-lead-queries.ts`:
  - Extend `OutreachLead` interface: add `linkedin_sent_at: string | null`,
    `fb_sent_at: string | null`, and `draft_letter`, `draft_email`, `draft_linkedin`,
    `draft_fb` (each `string | null`).
  - In `listLeadsByLane`'s SELECT: add the two new `MAX(sent_at)` channel subqueries for
    `linkedin` and `fb`, and select the four `draft_*` columns from `l`.
  - Add `saveDraft(db, leadId, channel: OutreachChannel, body: string): void` →
    `UPDATE leads SET draft_<channel> = ?, updated_at = datetime('now') WHERE id = ?`.
    Whitelist channel → column name (no string interpolation of raw input).
  - **Do NOT touch** `logTouch`/`clearTouch` (already correct and channel-agnostic).

### Agent 2 — Draft AI + pitch storage (all new/isolated files)
- `src/lib/outreach/pitch.ts` (NEW): `OUTREACH_PITCH_KEY = 'outreach_pitch'`,
  `DEFAULT_OUTREACH_PITCH` (the RekindleLeads pitch kit text, provided in the agent
  prompt), `getOutreachPitch(db)` (returns stored value or `DEFAULT_OUTREACH_PITCH`),
  `setOutreachPitch(db, text)`. Reuse `getSetting`/`setSetting` from
  `src/lib/queries/settings-queries.ts`.
- `src/lib/outreach/draft.ts` (NEW): `generateDraft(db, lead, channel)` →
  builds a channel-specific system prompt + user message from the lead's fields, the
  active lane's voice (`LANES[lead.lane]`), and the pitch (`getOutreachPitch`), then calls
  `askClaude(system, user, maxTokens, 'claude-sonnet-4-6')` from `src/lib/claude.ts`.
  Returns the generated string or `null` on failure. Channel shaping:
  - `letter`: handwritten note, one short page, operator voice, never mention automation,
    sign off "Phil Smith, RekindleLeads · 615-969-7941 · rekindleleads.com". ~1024 tokens.
  - `email`: a subject line + short body, include CAN-SPAM opt-out line. ~1024 tokens.
  - `linkedin`: a connection-request note **under 300 characters**, no links. ~400 tokens.
  - `fb`: a brief, casual Facebook Messenger DM mirroring the LinkedIn first-DM voice,
    no links. ~400 tokens.
  Output must be ONLY the ready-to-send message (no preamble, no notes). Personalize using
  the lead's `contact_person` (first name), `business_name`, `segment`/`category`, `city`.
  Match the proof number to industry per the pitch kit (RIA→80% content time,
  chiropractic→3x bookings, nonprofit→4x grants) when the segment/category fits.
- `src/app/api/outreach/pitch/route.ts` (NEW): `GET` → `{ pitch }` via `getOutreachPitch`;
  `POST {pitch}` → `setOutreachPitch`, returns `{ ok: true }`. Use `getDb()`.

### Agent 3 — API actions + UI
- `src/app/api/outreach/leads/route.ts`:
  - `CHANNELS` array → `['letter','email','phone','linkedin','fb']`.
  - New POST action `draft` `{leadId, channel}`: validate channel is one of
    `letter|email|linkedin|fb` (not phone), load the lead, call `generateDraft`, persist via
    `saveDraft`, return `{ ok: true, draft }`. 502 if generation returns null.
  - New POST action `save-draft` `{leadId, channel, body}`: persist edited text via
    `saveDraft`, return `{ ok: true }`.
- `src/components/outreach-leads.tsx`:
  - **Pitch box**: a collapsible panel near the top (above the table) titled
    "Your outreach pitch". Loads from `GET /api/outreach/pitch`, editable textarea, Save
    button → `POST /api/outreach/pitch`. Collapsed by default.
  - **Mark-sent column**: stack four `SendToggle`s — Letter · Email on the first line,
    LinkedIn · FB on the second. Reuse the existing `SendToggle` component.
  - **Badges**: render `linkedin_sent_at` and `fb_sent_at` as clickable `UnsendBadge`s too
    (labels e.g. `in {date}`, `f {date}`), same as letter/email.
  - **Expanded row drafting**: four "Draft letter / email / LinkedIn / FB" buttons. Clicking
    calls `POST /api/outreach/leads {action:'draft', channel}`, shows a loading state, then
    fills an editable `<textarea>` with the result. The textarea is seeded from the lead's
    saved `draft_<channel>` if present. Below it: **Copy** (clipboard) and **Mark sent**
    (`log-touch` for that channel). Edits persist via `save-draft` on blur. One draft area
    per channel, shown when that channel's Draft button is used or a saved draft exists.

## Shared contract (all agents code against these signatures)

- `OutreachChannel = 'letter' | 'email' | 'phone' | 'linkedin' | 'fb'`
- `saveDraft(db, leadId: number, channel: OutreachChannel, body: string): void`
- `generateDraft(db, lead: OutreachLead, channel: OutreachChannel): Promise<string | null>`
- `getOutreachPitch(db): string` / `setOutreachPitch(db, text: string): void`
- API `POST /api/outreach/leads`: actions `draft` → `{ok, draft}`, `save-draft` → `{ok}`.
- API `/api/outreach/pitch`: `GET` → `{pitch}`, `POST {pitch}` → `{ok}`.
- `askClaude(system, user, maxTokens, model)` from `@/lib/claude` (model `'claude-sonnet-4-6'`).

## Constraints / notes

- Agents must NOT run `npm run build` / `next build` / `git` — the lead integrates and builds
  once (parallel `next build`s corrupt `.next`). Type-only checks (`npx tsc --noEmit`) are OK
  but the lead runs the authoritative one.
- Drafting requires `ANTHROPIC_API_KEY` on the server (the `/generate` page already uses it).
- Reuse existing components/patterns; match surrounding code style. No unrelated refactors.

## Out of scope (v1)

- Sending email/messages from the app. Per-lane pitch variants. Draft version history
  (only latest per channel is kept). Phone drafting.
