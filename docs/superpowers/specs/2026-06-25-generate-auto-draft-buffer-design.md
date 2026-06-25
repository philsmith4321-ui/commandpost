# Auto-draft Generated Social Posts to Buffer — Design Spec

**Date:** 2026-06-25
**Status:** Approved (design); pending implementation plan
**Author:** Phil + Claude
**Builds on:** [Buffer queue integration](2026-06-25-buffer-queue-integration-design.md) (live, deployed)

## Goal

When a user generates a **social** post on the Generate page, automatically create a
matching **Buffer draft** so it appears in the `/social` queue for review — without the
user retyping or copy-pasting. Plus a one-time backfill button to push older social
generations. Drafts only: nothing publishes until the user acts in Buffer.

## Scope decisions (from brainstorming)

- **Only the 3 social content types** flow to Buffer: `social_linkedin → linkedin`,
  `social_twitter → x` (Buffer `twitter`), `social_facebook → facebook`. The four
  non-social types (`blog_article`, `email`, `email_sequence`, `campaign_plan`) are
  left alone — Buffer has no channel for them.
- **Draft, not scheduled.** Pushed via Buffer `saveToDraft: true`. Nothing posts
  publicly without the user scheduling it in Buffer / `/social`.
- **Trigger = auto-on-generate + backfill button.** Every new social generation
  auto-drafts; a history button pushes older social generations that haven't been
  pushed yet (idempotent).
- A social generation whose target channel isn't connected in Buffer is **skipped**
  (no crash, surfaced as skipped).

## Verified facts (probed live 2026-06-25)

- `createPost(... saveToDraft: true)` returns a post with `status: "draft"`.
- The default `posts(input:{organizationId})` query **includes draft posts** (returned
  `{draft:1, sent:49}`), so drafts show in the existing `/social` queue.
- `posts` filter accepts `status: ["draft"]` (valid enum value; `"drafts"` is invalid).
- Connected channels: `linkedin` (philip-smith), `twitter`/x (PhilSmith), `facebook`
  (ReKindle Leads). No Instagram. Org `6a3d74bed4c230629f229a87`.

## Components

### 1. `src/lib/buffer/queries.ts` — `createPost` gains `saveToDraft`
Extend the args to `{ channelId, text, mode, dueAt?, saveToDraft? }` and pass
`saveToDraft` through to `CreatePostInput`. Existing callers (the `/api/social/posts`
route) are unaffected (flag omitted → undefined → normal post).

**Draft mode detail (confirm in plan):** create the draft with `mode: 'addToQueue'`
and **no** `dueAt` (a draft has no scheduled time) + `saveToDraft: true`. If Buffer
rejects `addToQueue` without a date for a draft, fall back to `customScheduled` with a
far-future `dueAt`. Verify with one live `createPost` during implementation.

### 2. `src/lib/buffer/map.ts` — content-type → platform → channel
- `socialContentTypeToPlatform(contentType: GenContentType): Platform | null` —
  `social_linkedin→'linkedin'`, `social_twitter→'x'`, `social_facebook→'facebook'`,
  everything else → `null`. Pure function, unit-tested.
- Channel resolution: given the platform and the result of `listChannels()`, find the
  connected channel whose `platform` matches; return its `id` or `null` if none
  connected.

### 3. `generations` table — additive `buffer_post_id TEXT` column
- Migration: `ALTER TABLE generations ADD COLUMN buffer_post_id TEXT` (nullable,
  additive — no cold `.next` rebuild needed). Holds the Buffer draft's post id once
  pushed; `NULL` = not pushed.
- `generation-queries.ts`: include `buffer_post_id` in the `Generation` row; add
  `setGenerationBufferPostId(db, id, bufferPostId)` and
  `listUnpushedSocialGenerations(db)` (social content_type AND `buffer_post_id IS NULL`).

### 4. `POST /api/generate` — auto-draft after saving
After `createGeneration(...)`, if the content type is social **and** Buffer is
configured **and** a matching channel is connected:
- create a Buffer draft for the generation text,
- `setGenerationBufferPostId(...)`,
- include `buffer: { pushed: true, channel: <name> }` in the response.

This is **best-effort and non-fatal**: wrap in try/catch. On any failure (Buffer down,
no channel, not configured) the generation still returns 200 with
`buffer: { pushed: false, reason }` (or `null`). Generation must never fail because of
Buffer.

### 5. `POST /api/generate/backfill-buffer` — push older social generations
- Loads `listUnpushedSocialGenerations(db)`; for each, resolve channel and create a
  draft, then `setGenerationBufferPostId`.
- Per-item try/catch; returns `{ pushed, skipped, failed }` counts (skipped = no
  connected channel; failed = Buffer error).
- If Buffer not configured: return 400 with a clear message.

### 6. History UI (GenerateStudio)
- Show an "In Buffer (draft)" badge on social history items where `buffer_post_id` is
  set.
- A **"Send existing to queue"** button that POSTs to `/api/generate/backfill-buffer`,
  then refreshes history; shows the returned counts (e.g. "Pushed 4, skipped 1").
- Non-social items show no badge/button.

## Data flow

```
Generate POST → createGeneration → [social? configured? channel?] → Buffer draft
              → setGenerationBufferPostId → respond { ..., buffer }
Backfill POST → listUnpushedSocialGenerations → per item: draft + set id
              → respond { pushed, skipped, failed }
/social page  → posts() (already returns drafts) → drafts visible with status "draft"
```

## Error handling

- Auto-push: try/catch, never fails the generation; reasons surfaced softly.
- Backfill: per-item try/catch, aggregate counts; 400 if Buffer unconfigured.
- Channel not connected → skipped, not an error.

## Testing

- Unit: `socialContentTypeToPlatform` (all 7 types → correct platform/null); channel
  resolution (match / no-match); `createPost` `saveToDraft` passthrough (mocked client);
  `listUnpushedSocialGenerations` (returns only social + unpushed) and
  `setGenerationBufferPostId`.
- Route: `/api/generate` still 200 + correct `buffer` field when push succeeds, and
  still 200 when the Buffer push throws (non-fatal); `/api/generate/backfill-buffer`
  pushes only eligible items and reports counts; 400 when unconfigured.
- Buffer client mocked in all route/unit tests; one gated live `createPost` check
  during implementation to confirm the draft `mode`.

## Out of scope (YAGNI / later)

- Image/media on drafts (text-only, consistent with Buffer v1).
- Auto-scheduling (drafts only, by design).
- Pushing long-form/campaign content anywhere.
- De-duplicating repeated regenerations beyond the `buffer_post_id` idempotency guard
  (each distinct generation row gets at most one draft; regenerating creates a new row
  → a new draft, which is acceptable since drafts are low-stakes and reviewable).

## Deploy notes

- Migration is additive (`ADD COLUMN`) — safe; no cold `.next` wipe. Standard deploy
  (`git pull` + build + `pm2 restart`). No new npm deps.
