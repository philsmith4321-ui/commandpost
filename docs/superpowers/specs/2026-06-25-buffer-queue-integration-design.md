# Buffer Queue Integration — Design Spec

**Date:** 2026-06-25
**Status:** Approved (design); pending implementation plan
**Author:** Phil + Claude

## Goal

Make CommandPost the front-end ("cockpit") for the user's Buffer posting queue:
create, edit, reschedule, and delete scheduled social posts from inside CommandPost,
and read the live queue + post metrics back. CommandPost does **not** own the post
data — Buffer is the single source of truth.

## Verified API facts (probed 2026-06-25 against the live account)

- **Endpoint:** `https://api.buffer.com` — GraphQL, `Authorization: Bearer <key>`.
  The classic REST API (`api.bufferapp.com`) rejects this token
  (`"Public API tokens are not accepted for REST API access"`), so GraphQL is the
  only path.
- **Org id:** retrieved via `{ account { organizations { id } } }`. Stored as
  `BUFFER_ORG_ID` to avoid a lookup on every call.
- **Connected channels** (`channels(input:{organizationId})` → `id, service, name`):
  - `facebook` — "ReKindle Leads"
  - `linkedin` — "philip-smith-..."
  - `twitter` — "PhilSmith..." (Buffer says `twitter`; CommandPost's `Platform` is `x`)
  - No Instagram connected (won't appear until connected in Buffer).
- **Read queue:** `posts(input: PostsInput!, first, after)` → relay edges/nodes.
  - `PostsInput`: `organizationId!`, `filter: { channelIds, status, tags, dueAt, createdAt }`, `sort`.
  - `Post` fields available: `id, status, via, schedulingType, author, isCustomScheduled,
    createdAt, updatedAt, dueAt, sentAt, text, externalLink, metadata, channelId,
    channelService, channel, tags, notes, notificationStatus, error, assets, metrics,
    metricsUpdatedAt, allowedActions, sharedNow, shareMode`.
- **Mutations:**
  - `createPost(input: CreatePostInput!)` — required: `schedulingType`, `channelId`,
    `assets`, `mode`; plus `text`, `dueAt`, `metadata`, `tagIds`, `source`,
    `aiAssisted`, `saveToDraft`. `channelId` is **single** → multi-channel posting =
    one `createPost` per channel.
  - `editPost(input: EditPostInput!)` — same fields + `id` (used for text edit and
    reschedule via `dueAt`).
  - `deletePost(input: DeletePostInput!)` — `id` only.
- **To confirm during planning** (introspection didn't cleanly return enum values):
  exact `SchedulingType` and `ShareMode` enum values. Will nail them with a real
  `createPost` to a draft (`saveToDraft: true`) before building compose.

## Architecture

Browser → CommandPost server API route → Buffer GraphQL. **The API key never reaches
the browser.** Live proxy: no local posts table, no sync job, no drift.

```
src/lib/buffer/
  client.ts    // bufferGql(query, vars): POST api.buffer.com, Bearer from env, unwrap errors[]
  queries.ts   // listChannels, listPosts(filter), getPost, createPost, editPost, deletePost, getMetrics
  map.ts       // Buffer service <-> CommandPost Platform  (twitter<->x, facebook, linkedin)
  types.ts     // Channel, BufferPost, SchedulingType, ShareMode, filter types
```

A thin `BufferPublisher` is registered in the **existing** `src/lib/publishers/`
registry so the Phase-1 scaffolding (`getPublisher(platform).publish()`,
`isPlatformConfigured()`) finally resolves through Buffer. `publish()` maps to a
`createPost` (immediate or scheduled). Note the existing `Publisher` interface only
covers publish; the richer list/edit/delete operations live in `src/lib/buffer/`
directly and are not forced through that interface.

## Proxy API routes (server-only)

Same no-per-route-auth convention as the rest of the app.

- `GET    /api/social/status` → `{ configured, orgId, channels[] }`
- `GET    /api/social/posts?status=&channelId=&from=&to=` → live queue
- `POST   /api/social/posts` → create (body: `{ channelIds[], text, schedule }`; fans
  out to one `createPost` per channel, returns per-channel results)
- `PATCH  /api/social/posts/[id]` → edit text / reschedule (`dueAt`)
- `DELETE /api/social/posts/[id]` → delete

## UI surfaces (build order)

### Phase 1 — Foundation + Settings
Buffer client, proxy routes, and a "Social / Buffer" panel on the existing
`/settings` page showing connection status (`configured`) + connected channels.
Nothing downstream works until this is solid.

### Phase 2 — `/social` page (primary cockpit)
- Live queue grouped by status (queued / scheduled / sent). Each post shows channel
  (icon via `map.ts`), time (`dueAt`/`sentAt`), text, and — for sent — `metrics`.
- Compose modal: pick one-or-more channels, write text, choose **schedule at specific
  time** (`dueAt`) or **add to Buffer's next queue slot**.
- Edit & delete inline, gated by each post's `allowedActions`.
- Mutations refetch the queue (no optimistic UI in v1).

### Phase 3 — Calendar
Render Buffer scheduled posts as events on the existing `/calendar` page; click to
edit; drag to reschedule (→ `editPost` `dueAt`).

### Phase 4 — Generate button
"Send to Buffer" on a generation opens the same compose modal, prefilled with the
generated text.

## v1 scope boundaries

- **Text-only posts.** `assets` sent empty. Image/video attach is a later phase (would
  reuse `/api/content/image`).
- **Channels = whatever is connected in Buffer** (currently Facebook, LinkedIn, X).
- **Scheduling:** specific date/time + "add to queue". "Share now" optional / low cost.
- No per-route auth (matches the rest of the app).

## Security

- `BUFFER_API_KEY` + `BUFFER_ORG_ID` in the server `.env` (same pattern as
  `ANTHROPIC_API_KEY`). Never `NEXT_PUBLIC`. Touched only by proxy routes.
- **Rotate the API key** once wired — it was pasted in plaintext into a chat session.

## Error handling

- Buffer GraphQL `errors[]` → surfaced as a toast in the UI.
- `401` / token errors map to "Buffer key invalid/expired — check Settings."
- `allowedActions` on each post drives which edit/delete buttons are enabled.

## Testing

- Unit: `map.ts` (service↔platform both directions) and query builders with mocked
  `fetch`.
- Route tests mock the Buffer client (external service).
- A gated live smoke script (env-guarded, like the introspection probes) stays out of
  CI.

## Deploy notes (from prior CommandPost gotchas)

- Adding env vars → set them in the server `/var/www/commandpost/.env`; no `npm
  install` needed unless deps are added (this feature adds none).
- Standard deploy: `./scripts/deploy.sh` (or `git pull && npm run build && pm2 restart
  commandpost`). Never run two `next build`s concurrently. Don't wipe `.next` on the
  1.9 GB server without `pm2 stop` + `--max-old-space-size`.
