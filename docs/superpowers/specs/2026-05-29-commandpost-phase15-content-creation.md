# Phase 15: Content Creation — Design Spec

## Goal

Add a content-creation section for drafting social media posts to promote the user's
own business across X, LinkedIn, Facebook, and Instagram. A single "post" captures one
idea and produces a separately-editable variant per selected platform. Variants can be
written manually or generated with AI, then copied out to each network.

This is **Phase 1 (content core)**. Actual auto-publishing to each platform's API is a
deliberate follow-up (Phase 16+), one sub-project per platform, each gated on that
platform's OAuth app registration and approval process. This spec builds the data model,
UI, AI generation, and a pluggable publisher seam so those integrations drop in cleanly
later — but implements no live publishing.

## Scope decisions (from brainstorming)

- **Audience:** self-promotion only. Posts are NOT linked to clients.
- **Authoring:** manual writing with an optional "Generate with AI" assist.
- **Content model:** one idea → per-platform variants (X / LinkedIn / Facebook / Instagram).
- **Media:** one shared image per post (reused across variants).
- **Views:** list with status filter (no calendar view in Phase 1).
- **Publishing:** out of scope for Phase 1. Per-variant "Copy" + manual "Mark posted"
  provide day-one value. A `Publisher` interface + registry are defined now (all report
  "not configured") so Phase 2 wiring is ready.

## Architecture

Standard CommandPost vertical slice, following the invoices/proposals pattern:

- New `posts` table (one row per idea) + `post_variants` table (one row per platform).
- Platform metadata (char limits, labels, image requirement) centralized in
  `src/lib/platforms.ts`.
- Queries in `src/lib/queries/post-queries.ts`.
- Server actions in `src/lib/actions/post-actions.ts`.
- AI generation in `src/lib/content-generator.ts`, using the existing `askClaude` helper.
- Pages under `src/app/(dashboard)/content/`.
- Components in `src/components/` (`post-form.tsx`, `platform-badge.tsx`, char counter).
- Publisher seam in `src/lib/publishers/` (interface + registry, no implementations).
- New "Content" nav item in `sidebar.tsx` and `mobile-nav.tsx`.

## Database

### `posts` table

```sql
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  idea TEXT,
  image_path TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','scheduled','posted','archived')),
  scheduled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- `idea` stores the base topic/prompt used as the seed for the variants and for AI generation.
- `image_path` is the single shared image, stored via the existing file-upload mechanism.
- Post-level `status` is a roll-up of variant statuses, persisted for fast list filtering
  (see "Status roll-up" below).

### `post_variants` table

```sql
CREATE TABLE IF NOT EXISTS post_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK(platform IN ('x','linkedin','facebook','instagram')),
  content TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','scheduled','posted','failed')),
  published_at TEXT,
  platform_post_id TEXT,
  error TEXT,
  UNIQUE(post_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_post_variants_post ON post_variants(post_id);
```

- `enabled` marks whether the platform is targeted by this post (checkbox in the form).
- `published_at`, `platform_post_id`, `error` are reserved for Phase 2 publishing and stay
  null/empty in Phase 1.

### Migration

Add both `CREATE TABLE IF NOT EXISTS` statements (plus the index) to `initDb()` in
`src/lib/db.ts`, alongside the existing table definitions. No migration of existing data
is required (new feature).

## Platform config — `src/lib/platforms.ts`

Single source of truth, consumed by the char counter, form validation, and the AI prompt.

```ts
export type Platform = 'x' | 'linkedin' | 'facebook' | 'instagram';

export const PLATFORMS: Record<Platform, {
  label: string;
  charLimit: number;
  requiresImage?: boolean;
  icon: string;
}> = {
  x:         { label: 'X',         charLimit: 280 },
  linkedin:  { label: 'LinkedIn',  charLimit: 3000 },
  facebook:  { label: 'Facebook',  charLimit: 63206 },
  instagram: { label: 'Instagram', charLimit: 2200, requiresImage: true },
} as const;

export const PLATFORM_ORDER: Platform[] = ['x', 'linkedin', 'facebook', 'instagram'];
```

(Icon glyphs chosen during implementation to match the existing sidebar style.)

## Types — `src/lib/types.ts`

Add `Post`, `PostVariant`, and `PostWithVariants` types mirroring the existing
`Invoice` / `InvoiceWithClient` shapes, plus a `PostStatus` union.

## Queries — `src/lib/queries/post-queries.ts`

- `createPost(db, input)` — inserts the post, then inserts one `post_variants` row per
  selected platform. Returns the new post id.
- `getPostById(db, id)` — returns `PostWithVariants` (post + ordered variants), or undefined.
- `listPosts(db, statusFilter?)` — returns posts (newest first), optionally filtered by
  post-level status, with a lightweight variant summary (which platforms enabled) for the list.
- `updatePost(db, id, fields)` — updates post-level fields (title, idea, image_path,
  status, scheduled_at) and bumps `updated_at`.
- `upsertVariant(db, postId, platform, fields)` — updates content/enabled/status for a
  variant; inserts the row if a newly-enabled platform has none yet.
- `setVariantStatus(db, variantId, status, opts?)` — sets status and optional
  published_at/platform_post_id/error (used by "Mark posted" now and by publishing later).
- `deletePost(db, id)` — deletes the post (variants cascade).

## Status roll-up

A helper derives post-level status from its enabled variants and is called after any
variant change:

- all enabled variants `posted` → post `posted`
- any enabled variant `scheduled` (and none failed) → post `scheduled`
- otherwise → post `draft`
- `archived` is set only manually and is never overwritten by the roll-up.

## Server actions — `src/lib/actions/post-actions.ts`

- `createPostAction(formData)` — parses title, idea, selected platforms, image, per-platform
  content, status, scheduled_at; validates (see Error handling); calls `createPost`;
  `revalidatePath('/content')`; redirects to `/content/[id]`.
- `updatePostAction(formData)` — updates post + variants; revalidates.
- `deletePostAction(formData)` — deletes; redirects to `/content`.
- `generateVariantsAction(formData)` — calls `content-generator`; returns generated
  per-platform content to the form (does not auto-save). Uses the `useActionState` return
  pattern like the existing follow-up drafter.
- `markVariantPostedAction(formData)` — sets a variant to `posted` with `published_at = now`,
  then re-runs the status roll-up.
- `publishPostAction(formData)` — Phase-2 seam: iterates enabled variants and calls the
  publisher registry. In Phase 1 every platform reports "not configured", so this returns
  an informative message and changes nothing.

## AI generation — `src/lib/content-generator.ts`

- `generatePostVariants({ idea, platforms, tone })` builds a system prompt instructing
  Claude to produce one post per requested platform, each respecting that platform's
  character limit and conventions (concise + hashtags for X, professional for LinkedIn,
  conversational for Facebook, caption + hashtags for Instagram).
- Output uses a delimiter format parsed by a dedicated parser, mirroring
  `parseFollowUpResponse` in `lead-actions.ts`:

  ```
  ===X===
  <content>
  ===LINKEDIN===
  <content>
  ===FACEBOOK===
  <content>
  ===INSTAGRAM===
  <content>
  ```

- `parsePostVariants(text, platforms)` splits on the delimiters and returns a
  `Record<Platform, string>`, tolerating missing/extra sections (missing → empty string).
- **Model:** extend `askClaude` in `src/lib/claude.ts` to accept an optional `model`
  parameter (default unchanged so the existing follow-up feature is unaffected), and call
  it here with `claude-sonnet-4-6`.
- **Graceful degrade:** if `isClaudeConfigured()` is false or `askClaude` returns null,
  `generateVariantsAction` returns an inline error; manual editing continues to work.

## Routes / UI

### `/content` — List page
`src/app/(dashboard)/content/page.tsx`

- Header: "Content" title + "New Post" button (matches Clients/Invoices layout).
- Status filter tabs: All / Draft / Scheduled / Posted / Archived.
- List rows: title, platform badges (enabled platforms), post status badge, scheduled date
  (if set), created date. Row links to `/content/[id]`.

### `/content/new` — Compose page
`src/app/(dashboard)/content/new/page.tsx` — renders `PostForm` bound to `createPostAction`.

### `/content/[id]` — Detail / edit page
`src/app/(dashboard)/content/[id]/page.tsx` — renders `PostForm` bound to `updatePostAction`,
plus a delete action and per-variant Copy / Mark-posted controls.

## Components

### `post-form.tsx`
- Title (required), idea textarea.
- Platform checkboxes (X / LinkedIn / Facebook / Instagram) — toggling shows/hides that
  platform's content textarea.
- Single shared image upload, reusing the existing `document-upload` mechanism.
- Per-platform content textarea, each with a **live character counter** that turns red when
  over `PLATFORMS[platform].charLimit`.
- "Generate with AI" button (+ optional tone/instructions text field) that calls
  `generateVariantsAction` and fills the enabled textareas; user edits before saving.
- Status select + scheduled date input.
- Save button; on the edit page, also a Delete button.

### `platform-badge.tsx`
Small per-platform chip (icon + label), consistent with `status-badge.tsx`.

### Per-variant controls (on detail page)
- **Copy** button — copies that variant's text to clipboard (and surfaces the shared image
  for download), the practical publish path in Phase 1.
- **Mark posted** button — calls `markVariantPostedAction`.

## Sidebar / nav

Add a "Content" nav item to both `src/components/sidebar.tsx` and
`src/components/mobile-nav.tsx`, placed near Templates/Automations. Use an unused glyph
consistent with the existing icon set (final glyph chosen in implementation).

## Error handling / validation

- Title is required.
- At least one platform must be enabled.
- If Instagram is enabled, an image is required (`PLATFORMS.instagram.requiresImage`).
- Over-limit content warns visually (red counter) but still saves; the publish path will
  block over-limit variants in Phase 2.
- AI generation failure (not configured / API error) surfaces inline without clearing the
  form or blocking manual editing.

## Phase-2 publisher seam — `src/lib/publishers/`

Defined now, no live implementations:

```ts
// src/lib/publishers/types.ts
export interface Publisher {
  platform: Platform;
  isConfigured(): boolean;
  publish(input: { content: string; imagePath: string | null }):
    Promise<{ platformPostId: string }>;
}
```

`src/lib/publishers/index.ts` exposes a registry keyed by platform. In Phase 1 every entry
either is absent or returns `isConfigured() === false`, so `publishPostAction` reports
"connect accounts to publish" and makes no external calls. Each future platform integration
is a single file implementing `Publisher` plus its registry entry.

## Testing (vitest, following `tests/queries/` style)

- `post-queries`: create post with variants; `getPostById` returns ordered variants;
  `listPosts` status filter; `upsertVariant` update + insert-on-enable; cascade delete
  removes variants.
- Status roll-up helper: draft / scheduled / posted / archived transitions.
- `platforms` config: char limits present for all four; Instagram `requiresImage`.
- `parsePostVariants`: well-formed multi-section input; missing section → empty string;
  extra/unknown section ignored.

## Out of scope (Phase 1)

- Live publishing to any platform API (OAuth, token storage, app review) — Phase 16+.
- Calendar view (list + status filter only).
- Per-platform images and multi-image carousels.
- Stored brand-voice settings (tone is a per-generation field).
- Linking posts to clients/projects.
