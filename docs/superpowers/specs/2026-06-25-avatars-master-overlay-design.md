# CommandPost Avatars — Master Profile + Vertical Overlay

**Date:** 2026-06-25
**Status:** Approved (design)
**Area:** `/avatars` page, Generate composition, content generation

## Purpose

Replace CommandPost's flat avatar model with a **Master Profile + Vertical Overlay**
architecture for RekindleLeads marketing content. The app composes a target by combining
the single Master (tone, identity, universal objections, trust builders) with **exactly one**
vertical overlay (industry pain, vocabulary, proof, channels), plus the per-run content brief.
Maintain the Master once; swap overlays per audience. **Never blend two verticals** in one
piece — the vocabulary and objections clash and it reads as generic.

## Decisions (from brainstorming)

- **Data model:** Fully structured fields (not prose blobs). Each overlay stores discrete
  fields so composition is deterministic and content rules are enforceable.
- **Generate picker:** Master is always applied; pick exactly one vertical. Keep an
  **"All verticals"** option but label it `⚠ generic` (off-spec, for general/internal content).
- **Seed & migrate:** Seed Master + 4 overlays from the doc; **keep existing flat avatars
  active as-is** (new structured fields are nullable so sparse old avatars still work).
- **Content rules:** Wire objection-handling + proof-injection into generation for **all
  content types** (long-form, campaigns, and social).

## Data Model

### New table: `master_profile` (singleton, id always = 1)

| Column          | Type | Notes |
|-----------------|------|-------|
| `id`            | INTEGER PK | `CHECK (id = 1)` — single row |
| `identity`      | TEXT | Core identity / who they are (the Owner Who Built It) |
| `wants`         | TEXT | What they actually want (the result, time back) |
| `burned_by`     | TEXT | How they've been burned (agencies, SaaS, gurus) |
| `buying_trigger`| TEXT | Universal buying-trigger shape |
| `tone`          | TEXT | Tone for all content |
| `objections`    | TEXT (JSON) | Array of `{ objection, counter }` — the 5 universal objections, each with its counter |
| `trust_builders`| TEXT (JSON) | Array of strings — what earns their trust |
| `updated_at`    | TEXT | `datetime('now')` |

### Extend table: `avatars` (verticals) — additive nullable columns

Migrated with guarded `ALTER TABLE ... ADD COLUMN` (the existing `db.ts` pattern). No table
rebuild → safe on the 1.9 GB server, no cold `.next` wipe required.

| New column        | Type | Notes |
|-------------------|------|-------|
| `persona`         | TEXT | e.g. "David, the Fiduciary" |
| `buying_trigger`  | TEXT | Vertical-specific trigger |
| `proof_point`     | TEXT | Real proof to inject (PWI / Zerona / GrantCraft / SkyTrain-adjacent) |
| `writing_target`  | TEXT | The one-sentence anchor instruction |
| `what_tried`      | TEXT | What they've already tried (context) |
| `pains`           | TEXT (JSON) | Array of strings — in their words |
| `desires`         | TEXT (JSON) | Array of strings — desired outcome(s) |
| `objections`      | TEXT (JSON) | Array of strings — vertical-specific objections |
| `vocabulary`      | TEXT (JSON) | Array of strings |
| `trust_triggers`  | TEXT (JSON) | Array of strings |
| `channels`        | TEXT (JSON) | Array of strings |

Existing columns (`name`, `summary`, `description`, `tone`, `is_active`, timestamps) are
unchanged. `name` holds the vertical title (e.g. "Fee-Only RIA / Financial Advisor").

The `Avatar` TypeScript interface (`src/lib/types.ts`) gains the new optional fields; a new
`MasterProfile` interface is added. JSON-array columns are parsed/serialized at the query layer.

## Composition Logic (`src/lib/generation/audience.ts`)

New `composeAudience(master, vertical?, mode?)` returns the system-context block:

1. **MASTER block (always):** identity, wants, tone, universal objections (with counters),
   trust builders, buying-trigger shape.
2. **VERTICAL block (one):** persona, pains, desires, vocabulary, trust triggers, channels,
   buying trigger — with `writing_target` rendered as **the anchor instruction** the model
   must follow.
3. **CONTENT RULES (all content types):**
   - "Resolve at least one master objection (use its counter) **and** at least one
     vertical-specific objection in this piece."
   - "Weave in this proof point for credibility: `{proof_point}`."
4. **mode === 'all'** ("All verticals ⚠ generic"): emit MASTER + a generic note that lists the
   vertical names but does **not** merge their vocabularies. No two-vertical blend.

The legacy `avatarToAudience` / `blendedAudience` helpers are superseded; `blendedAudience`'s
call site moves to the `mode === 'all'` branch of `composeAudience`.

## API

- **`/api/master`** (new): `GET` returns the singleton; `PUT` upserts it.
- **`/api/avatars`** + **`/api/avatars/[id]`**: extend create/update payloads to accept the new
  structured fields (arrays as JSON). `AvatarInput` gains the new optional fields.
- **`/api/generate`**: always load the Master; resolve the selected vertical (id), or `'all'`,
  or none; call `composeAudience(...)`. Continue recording `generations.avatar_id`.

## UI — `/avatars`

- **Master Profile card** at the top: a distinct editor (title "Master Profile — The Owner Who
  Built It"), edit-in-place, always exactly one. Fields: identity, wants, burned_by,
  buying_trigger, tone, universal objections (objection + counter rows), trust builders.
- **Vertical Overlays** below: the existing avatar list. The editor is expanded to the new
  structured fields. Array fields are edited as **one-item-per-line** textareas
  (parsed to arrays on save). Old sparse avatars render and edit fine (empty new fields).
- Pink/dark visual language is retained to match the current page.

## Generate Page

- Audience selector shows **"Master Profile: always applied"** as a fixed note.
- Vertical is **single-select** (radio/dropdown) over active verticals, plus
  **"All verticals ⚠ generic"** (repurposes today's "All avatars" option) and an implicit
  "Master only / none".

## Seeding

Idempotent seed inside the `db.ts` migration (runs on every boot, inserts only when absent):

- If `master_profile` has no row → insert the Master from the doc.
- For each of the 4 overlays (Fee-Only RIA, Chiropractor, Faith-Based Nonprofit, Home
  Services) → insert **only if no avatar with that name exists**.
- Existing avatars are never modified or deleted.

Seed content is the verbatim structured data from the RekindleLeads Marketing Avatars doc,
including each overlay's `proof_point` (RIA→PWI, Chiro→Zerona/White House,
Nonprofit→GrantCraft/Way Maker Place, Home Services→SkyTrain-adjacent field/lead-gen).

## Testing

- **`composeAudience` unit tests:**
  - master-only: master block present, no vertical block.
  - master+vertical: both blocks present; `writing_target` rendered as the anchor; content
    rules (objection + proof) present; only the one vertical's vocabulary appears.
  - mode 'all': master present; vertical names listed but vocabularies not merged.
- **Migration tests:** new columns exist; master seeded exactly once across repeated boots
  (idempotent); the 4 overlays seeded once; pre-existing avatars untouched.

## Deploy Notes

- **No new dependencies** → standard deploy: `git pull && npm run build && pm2 restart commandpost`.
  No `npm install` needed.
- Migration is purely additive `ADD COLUMN` + new table + guarded inserts → **no cold `.next`
  wipe**, safe under the 2 GB swapfile.
- Watch the known deploy gotcha: server may have a locally-modified `package-lock.json` that
  aborts `git pull` — `git checkout -- package-lock.json` first if so.

## Out of Scope

- Per-vertical analytics / performance tracking.
- Importing avatars from external JSON files (seed is in-code).
- Changing the keyword-RAG retrieval (untouched).
