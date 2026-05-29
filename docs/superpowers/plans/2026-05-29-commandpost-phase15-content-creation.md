# Phase 15: Content Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a content-creation section to CommandPost for drafting social posts (X / LinkedIn / Facebook / Instagram) from one idea into per-platform variants, written manually or with optional AI assist, with a shared image, list/status views, and copy/mark-posted controls.

**Architecture:** Standard CommandPost vertical slice — two SQLite tables (`posts` + `post_variants`), query module, server actions, App-Router pages, and components. AI generation reuses the existing `askClaude` helper. A pluggable `Publisher` interface + registry are added as the seam for Phase-2 auto-publishing, but no live publishing is implemented.

**Tech Stack:** Next.js 16.2.6 (App Router, Turbopack), better-sqlite3, TypeScript, Tailwind CSS v4, Vitest. Spec: `docs/superpowers/specs/2026-05-29-commandpost-phase15-content-creation.md`.

---

## Conventions (read before starting)

- Query functions take `(db: Database.Database, ...)` as the first arg and live in `src/lib/queries/*.ts`. See `src/lib/queries/invoice-queries.ts`.
- Server actions are `'use server'`, call `getDb()`, mutate via queries, then `revalidatePath(...)` and (for create/update) `redirect(...)`. See `src/lib/actions/invoice-actions.ts`.
- Tables are created in `initDb()` in `src/lib/db.ts`; new tables are appended as a `db.exec(...)` block immediately before `return db;` (line ~611).
- Tests use `initDb(':memory:')` in a `beforeEach`. See `tests/queries/proposal-queries.test.ts`.
- Pages are async, read `params`/`searchParams` as Promises (Next 16), call `getDb()`, and use `notFound()`. Auth is handled by the `(dashboard)` layout — pages need no auth checks.
- Tailwind input style used across forms: `w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500`.
- Run a single test file: `npx vitest run <path>`. Run all tests: `npm test`. Build: `npm run build`. Lint: `npm run lint`.

---

## File Structure

**Create:**
- `src/lib/platforms.ts` — platform config (labels, char limits, image requirement, order)
- `src/lib/queries/post-queries.ts` — posts + variants data access
- `src/lib/content-generator.ts` — AI prompt builder, response parser, generate function
- `src/lib/publishers/types.ts` — `Publisher` interface (Phase-2 seam)
- `src/lib/publishers/index.ts` — publisher registry (empty in Phase 1)
- `src/lib/actions/post-actions.ts` — server actions
- `src/app/api/content/image/route.ts` — image upload (POST)
- `src/app/api/content/image/[filename]/route.ts` — image serve (GET)
- `src/components/platform-badge.tsx` — platform chip
- `src/components/copy-button.tsx` — clipboard button
- `src/components/post-image-upload.tsx` — image upload widget
- `src/components/post-form.tsx` — compose/edit form
- `src/app/(dashboard)/content/page.tsx` — list page
- `src/app/(dashboard)/content/new/page.tsx` — compose page
- `src/app/(dashboard)/content/[id]/page.tsx` — detail/edit page
- `tests/platforms.test.ts`
- `tests/queries/post-queries.test.ts`
- `tests/content-generator.test.ts`

**Modify:**
- `src/lib/types.ts` — add post types
- `src/lib/db.ts` — add tables
- `src/lib/claude.ts` — add optional `model` param
- `src/components/status-badge.tsx` — add scheduled/posted/archived colors
- `src/components/sidebar.tsx` — add "Content" nav item
- `src/components/mobile-nav.tsx` — add "Content" nav item

---

## Task 1: Platform config + types

**Files:**
- Create: `src/lib/platforms.ts`
- Create: `tests/platforms.test.ts`
- Modify: `src/lib/types.ts` (append at end)

- [ ] **Step 1: Write the failing test**

Create `tests/platforms.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { PLATFORMS, PLATFORM_ORDER, isPlatform } from '@/lib/platforms';

describe('PLATFORMS', () => {
  it('defines all four platforms with char limits', () => {
    expect(PLATFORMS.x.charLimit).toBe(280);
    expect(PLATFORMS.linkedin.charLimit).toBe(3000);
    expect(PLATFORMS.facebook.charLimit).toBe(63206);
    expect(PLATFORMS.instagram.charLimit).toBe(2200);
  });

  it('marks instagram as requiring an image', () => {
    expect(PLATFORMS.instagram.requiresImage).toBe(true);
    expect(PLATFORMS.x.requiresImage).toBe(false);
  });

  it('orders platforms x, linkedin, facebook, instagram', () => {
    expect(PLATFORM_ORDER).toEqual(['x', 'linkedin', 'facebook', 'instagram']);
  });

  it('isPlatform validates platform strings', () => {
    expect(isPlatform('x')).toBe(true);
    expect(isPlatform('myspace')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/platforms.test.ts`
Expected: FAIL — cannot find module `@/lib/platforms`.

- [ ] **Step 3: Create the platform config**

Create `src/lib/platforms.ts`:

```ts
export type Platform = 'x' | 'linkedin' | 'facebook' | 'instagram';

export interface PlatformConfig {
  label: string;
  charLimit: number;
  requiresImage: boolean;
  icon: string;
}

export const PLATFORMS: Record<Platform, PlatformConfig> = {
  x: { label: 'X', charLimit: 280, requiresImage: false, icon: '𝕏' },
  linkedin: { label: 'LinkedIn', charLimit: 3000, requiresImage: false, icon: 'in' },
  facebook: { label: 'Facebook', charLimit: 63206, requiresImage: false, icon: 'f' },
  instagram: { label: 'Instagram', charLimit: 2200, requiresImage: true, icon: '◐' },
};

export const PLATFORM_ORDER: Platform[] = ['x', 'linkedin', 'facebook', 'instagram'];

export function isPlatform(value: string): value is Platform {
  return value in PLATFORMS;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/platforms.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Add post types**

Append to `src/lib/types.ts`:

```ts
import type { Platform } from '@/lib/platforms';

export type PostStatus = 'draft' | 'scheduled' | 'posted' | 'archived';
export type VariantStatus = 'draft' | 'scheduled' | 'posted' | 'failed';

export interface Post {
  id: number;
  title: string;
  idea: string | null;
  image_path: string | null;
  status: PostStatus;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostVariant {
  id: number;
  post_id: number;
  platform: Platform;
  content: string;
  enabled: number;
  status: VariantStatus;
  published_at: string | null;
  platform_post_id: string | null;
  error: string | null;
}

export interface PostWithVariants extends Post {
  variants: PostVariant[];
}
```

Note: `src/lib/types.ts` currently has no imports at the top. Adding an `import type` line is fine — TypeScript hoists it; place it at the very top of the file.

- [ ] **Step 6: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors related to `types.ts` or `platforms.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/platforms.ts tests/platforms.test.ts src/lib/types.ts
git commit -m "feat: add platform config and post types for content creation"
```

---

## Task 2: Database schema

**Files:**
- Modify: `src/lib/db.ts` (insert before `return db;`, ~line 611)
- Create: `tests/queries/post-queries.test.ts` (schema smoke test only for now)

- [ ] **Step 1: Write the failing test**

Create `tests/queries/post-queries.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { initDb } from '@/lib/db';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeEach(() => {
  db = initDb(':memory:');
});

describe('posts schema', () => {
  it('creates posts and post_variants tables', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('posts','post_variants')")
      .all() as { name: string }[];
    const names = tables.map((t) => t.name).sort();
    expect(names).toEqual(['post_variants', 'posts']);
  });

  it('cascades variant deletion when a post is deleted', () => {
    db.prepare("INSERT INTO posts (title) VALUES ('Test')").run();
    db.prepare("INSERT INTO post_variants (post_id, platform, content) VALUES (1, 'x', 'hi')").run();
    db.prepare('DELETE FROM posts WHERE id = 1').run();
    const count = (db.prepare('SELECT COUNT(*) as c FROM post_variants').get() as { c: number }).c;
    expect(count).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/queries/post-queries.test.ts`
Expected: FAIL — `no such table: posts`.

- [ ] **Step 3: Add the tables**

In `src/lib/db.ts`, immediately before `return db;` (after the `automation_log` migration block, ~line 609), insert:

```ts
  // Migration: create posts + post_variants tables (Phase 15 content creation)
  db.exec(`
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
  `);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/queries/post-queries.test.ts`
Expected: PASS (2 tests). The cascade test confirms `foreign_keys = ON` is active.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts tests/queries/post-queries.test.ts
git commit -m "feat: add posts and post_variants tables"
```

---

## Task 3: Post queries — create, get, list, update, delete

**Files:**
- Create: `src/lib/queries/post-queries.ts`
- Modify: `tests/queries/post-queries.test.ts` (add cases)

- [ ] **Step 1: Write the failing tests**

Append to `tests/queries/post-queries.test.ts` (add the imports at the top of the file, merging with the existing `initDb` import):

```ts
import {
  createPost,
  getPostById,
  listPosts,
  updatePost,
  deletePost,
} from '@/lib/queries/post-queries';

describe('createPost / getPostById', () => {
  it('creates a post with variants and reads it back ordered', () => {
    const id = createPost(db, {
      title: 'Launch',
      idea: 'announce the launch',
      image_path: 'abc.jpg',
      variants: [
        { platform: 'facebook', content: 'fb text', enabled: true },
        { platform: 'x', content: 'x text', enabled: true },
      ],
    });
    const post = getPostById(db, id);
    expect(post).toBeDefined();
    expect(post!.title).toBe('Launch');
    expect(post!.image_path).toBe('abc.jpg');
    expect(post!.status).toBe('draft');
    // ordered by PLATFORM_ORDER: x before facebook
    expect(post!.variants.map((v) => v.platform)).toEqual(['x', 'facebook']);
    expect(post!.variants[0].content).toBe('x text');
    expect(post!.variants[0].enabled).toBe(1);
  });

  it('returns undefined for a missing id', () => {
    expect(getPostById(db, 999)).toBeUndefined();
  });
});

describe('listPosts', () => {
  it('lists posts newest first with enabled platforms', () => {
    createPost(db, { title: 'A', variants: [{ platform: 'x', content: '', enabled: true }] });
    createPost(db, {
      title: 'B',
      variants: [
        { platform: 'x', content: '', enabled: true },
        { platform: 'linkedin', content: '', enabled: true },
      ],
    });
    const list = listPosts(db);
    expect(list).toHaveLength(2);
    expect(list[0].title).toBe('B');
    expect(list[0].platforms).toEqual(['x', 'linkedin']);
  });

  it('filters by status', () => {
    const id = createPost(db, { title: 'A', variants: [{ platform: 'x', content: '', enabled: true }] });
    updatePost(db, id, { status: 'archived' });
    expect(listPosts(db, 'archived')).toHaveLength(1);
    expect(listPosts(db, 'draft')).toHaveLength(0);
    expect(listPosts(db, 'all')).toHaveLength(1);
  });
});

describe('updatePost / deletePost', () => {
  it('updates post-level fields', () => {
    const id = createPost(db, { title: 'A', variants: [{ platform: 'x', content: '', enabled: true }] });
    updatePost(db, id, { title: 'A2', idea: 'new idea', scheduled_at: '2026-06-01', status: 'scheduled' });
    const post = getPostById(db, id)!;
    expect(post.title).toBe('A2');
    expect(post.idea).toBe('new idea');
    expect(post.scheduled_at).toBe('2026-06-01');
    expect(post.status).toBe('scheduled');
  });

  it('deletes a post', () => {
    const id = createPost(db, { title: 'A', variants: [{ platform: 'x', content: '', enabled: true }] });
    deletePost(db, id);
    expect(getPostById(db, id)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/queries/post-queries.test.ts`
Expected: FAIL — cannot find module `@/lib/queries/post-queries`.

- [ ] **Step 3: Implement the query module**

Create `src/lib/queries/post-queries.ts`:

```ts
import type Database from 'better-sqlite3';
import type { Post, PostVariant, PostWithVariants, PostStatus, VariantStatus } from '@/lib/types';
import { type Platform, PLATFORM_ORDER } from '@/lib/platforms';

export interface CreatePostInput {
  title: string;
  idea?: string | null;
  image_path?: string | null;
  status?: PostStatus;
  scheduled_at?: string | null;
  variants: { platform: Platform; content: string; enabled: boolean }[];
}

export interface UpdatePostInput {
  title?: string;
  idea?: string | null;
  image_path?: string | null;
  status?: PostStatus;
  scheduled_at?: string | null;
}

export interface PostListItem extends Post {
  platforms: Platform[];
}

function orderIndex(platform: Platform): number {
  return PLATFORM_ORDER.indexOf(platform);
}

export function createPost(db: Database.Database, input: CreatePostInput): number {
  const result = db
    .prepare(
      `INSERT INTO posts (title, idea, image_path, status, scheduled_at)
       VALUES (@title, @idea, @image_path, @status, @scheduled_at)`
    )
    .run({
      title: input.title,
      idea: input.idea ?? null,
      image_path: input.image_path ?? null,
      status: input.status ?? 'draft',
      scheduled_at: input.scheduled_at ?? null,
    });

  const postId = Number(result.lastInsertRowid);

  const insertVariant = db.prepare(
    'INSERT INTO post_variants (post_id, platform, content, enabled) VALUES (?, ?, ?, ?)'
  );
  for (const v of input.variants) {
    insertVariant.run(postId, v.platform, v.content, v.enabled ? 1 : 0);
  }

  return postId;
}

export function getPostById(db: Database.Database, id: number): PostWithVariants | undefined {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as Post | undefined;
  if (!post) return undefined;

  const variants = db
    .prepare('SELECT * FROM post_variants WHERE post_id = ?')
    .all(id) as PostVariant[];
  variants.sort((a, b) => orderIndex(a.platform) - orderIndex(b.platform));

  return { ...post, variants };
}

export function listPosts(db: Database.Database, statusFilter?: string): PostListItem[] {
  let sql = 'SELECT * FROM posts';
  const params: unknown[] = [];
  if (statusFilter && statusFilter !== 'all') {
    sql += ' WHERE status = ?';
    params.push(statusFilter);
  }
  sql += ' ORDER BY created_at DESC, id DESC';

  const posts = db.prepare(sql).all(...params) as Post[];

  return posts.map((post) => {
    const rows = db
      .prepare('SELECT platform FROM post_variants WHERE post_id = ? AND enabled = 1')
      .all(post.id) as { platform: Platform }[];
    const platforms = rows.map((r) => r.platform).sort((a, b) => orderIndex(a) - orderIndex(b));
    return { ...post, platforms };
  });
}

export function updatePost(db: Database.Database, id: number, input: UpdatePostInput): void {
  const fields: string[] = [];
  const params: Record<string, unknown> = { id };

  if (input.title !== undefined) { fields.push('title = @title'); params.title = input.title; }
  if (input.idea !== undefined) { fields.push('idea = @idea'); params.idea = input.idea; }
  if (input.image_path !== undefined) { fields.push('image_path = @image_path'); params.image_path = input.image_path; }
  if (input.status !== undefined) { fields.push('status = @status'); params.status = input.status; }
  if (input.scheduled_at !== undefined) { fields.push('scheduled_at = @scheduled_at'); params.scheduled_at = input.scheduled_at; }

  if (fields.length === 0) return;

  fields.push("updated_at = datetime('now')");
  db.prepare(`UPDATE posts SET ${fields.join(', ')} WHERE id = @id`).run(params);
}

export function deletePost(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM posts WHERE id = ?').run(id);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/queries/post-queries.test.ts`
Expected: PASS (all cases including the Task-2 schema tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/post-queries.ts tests/queries/post-queries.test.ts
git commit -m "feat: add post-queries create/get/list/update/delete"
```

---

## Task 4: Post queries — variant upsert + posted sync

**Files:**
- Modify: `src/lib/queries/post-queries.ts`
- Modify: `tests/queries/post-queries.test.ts`

`syncPostPosted` only ever *promotes* a post to `posted` when every enabled variant is posted. It never demotes or overrides the manual `status` select — this avoids conflicts with the user-chosen draft/scheduled/archived value.

- [ ] **Step 1: Write the failing tests**

Append to `tests/queries/post-queries.test.ts` (extend the post-queries import list with `upsertVariant`, `setVariantStatus`, `syncPostPosted`):

```ts
import { upsertVariant, setVariantStatus, syncPostPosted } from '@/lib/queries/post-queries';

describe('upsertVariant', () => {
  it('inserts a variant row when the platform has none', () => {
    const id = createPost(db, { title: 'A', variants: [{ platform: 'x', content: 'x', enabled: true }] });
    upsertVariant(db, id, 'linkedin', { content: 'li text', enabled: true });
    const post = getPostById(db, id)!;
    expect(post.variants.map((v) => v.platform)).toEqual(['x', 'linkedin']);
    expect(post.variants.find((v) => v.platform === 'linkedin')!.content).toBe('li text');
  });

  it('updates content and enabled on an existing variant', () => {
    const id = createPost(db, { title: 'A', variants: [{ platform: 'x', content: 'old', enabled: true }] });
    upsertVariant(db, id, 'x', { content: 'new', enabled: false });
    const v = getPostById(db, id)!.variants[0];
    expect(v.content).toBe('new');
    expect(v.enabled).toBe(0);
  });
});

describe('setVariantStatus / syncPostPosted', () => {
  it('sets a variant to posted with published_at', () => {
    const id = createPost(db, { title: 'A', variants: [{ platform: 'x', content: 'x', enabled: true }] });
    const variantId = getPostById(db, id)!.variants[0].id;
    setVariantStatus(db, variantId, 'posted', { published_at: '2026-06-01T10:00:00Z' });
    const v = getPostById(db, id)!.variants[0];
    expect(v.status).toBe('posted');
    expect(v.published_at).toBe('2026-06-01T10:00:00Z');
  });

  it('promotes post to posted only when all enabled variants are posted', () => {
    const id = createPost(db, {
      title: 'A',
      variants: [
        { platform: 'x', content: 'x', enabled: true },
        { platform: 'linkedin', content: 'li', enabled: true },
      ],
    });
    const [vx, vli] = getPostById(db, id)!.variants;
    setVariantStatus(db, vx.id, 'posted');
    syncPostPosted(db, id);
    expect(getPostById(db, id)!.status).toBe('draft'); // not all posted yet
    setVariantStatus(db, vli.id, 'posted');
    syncPostPosted(db, id);
    expect(getPostById(db, id)!.status).toBe('posted');
  });

  it('does not override an archived post', () => {
    const id = createPost(db, { title: 'A', variants: [{ platform: 'x', content: 'x', enabled: true }] });
    updatePost(db, id, { status: 'archived' });
    const vId = getPostById(db, id)!.variants[0].id;
    setVariantStatus(db, vId, 'posted');
    syncPostPosted(db, id);
    expect(getPostById(db, id)!.status).toBe('archived');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/queries/post-queries.test.ts`
Expected: FAIL — `upsertVariant`/`setVariantStatus`/`syncPostPosted` are not exported.

- [ ] **Step 3: Implement the new functions**

Append to `src/lib/queries/post-queries.ts`:

```ts
export function upsertVariant(
  db: Database.Database,
  postId: number,
  platform: Platform,
  fields: { content?: string; enabled?: boolean; status?: VariantStatus }
): void {
  const existing = db
    .prepare('SELECT id FROM post_variants WHERE post_id = ? AND platform = ?')
    .get(postId, platform) as { id: number } | undefined;

  if (existing) {
    const sets: string[] = [];
    const params: Record<string, unknown> = { id: existing.id };
    if (fields.content !== undefined) { sets.push('content = @content'); params.content = fields.content; }
    if (fields.enabled !== undefined) { sets.push('enabled = @enabled'); params.enabled = fields.enabled ? 1 : 0; }
    if (fields.status !== undefined) { sets.push('status = @status'); params.status = fields.status; }
    if (sets.length > 0) {
      db.prepare(`UPDATE post_variants SET ${sets.join(', ')} WHERE id = @id`).run(params);
    }
  } else {
    db.prepare(
      'INSERT INTO post_variants (post_id, platform, content, enabled, status) VALUES (?, ?, ?, ?, ?)'
    ).run(postId, platform, fields.content ?? '', fields.enabled ? 1 : 0, fields.status ?? 'draft');
  }
}

export function setVariantStatus(
  db: Database.Database,
  variantId: number,
  status: VariantStatus,
  opts?: { published_at?: string; platform_post_id?: string; error?: string | null }
): void {
  db.prepare(
    `UPDATE post_variants
     SET status = @status, published_at = @published_at, platform_post_id = @platform_post_id, error = @error
     WHERE id = @id`
  ).run({
    id: variantId,
    status,
    published_at: opts?.published_at ?? null,
    platform_post_id: opts?.platform_post_id ?? null,
    error: opts?.error ?? null,
  });
}

export function syncPostPosted(db: Database.Database, postId: number): void {
  const post = db.prepare('SELECT status FROM posts WHERE id = ?').get(postId) as
    | { status: PostStatus }
    | undefined;
  if (!post || post.status === 'archived') return;

  const enabled = db
    .prepare('SELECT status FROM post_variants WHERE post_id = ? AND enabled = 1')
    .all(postId) as { status: VariantStatus }[];

  if (enabled.length > 0 && enabled.every((v) => v.status === 'posted')) {
    db.prepare("UPDATE posts SET status = 'posted', updated_at = datetime('now') WHERE id = ?").run(postId);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/queries/post-queries.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/post-queries.ts tests/queries/post-queries.test.ts
git commit -m "feat: add variant upsert and posted-status sync"
```

---

## Task 5: Claude model parameter

**Files:**
- Modify: `src/lib/claude.ts`

This adds an optional `model` argument so the new feature can use `claude-sonnet-4-6` while the existing follow-up drafter (which calls `askClaude` with 2 args) keeps the current default model unchanged.

- [ ] **Step 1: Update the signature and body**

In `src/lib/claude.ts`, change the function signature and the `model` field in the request body:

```ts
export async function askClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 1024,
  model: string = 'claude-sonnet-4-20250514'
): Promise<string | null> {
```

And in the `body: JSON.stringify({ ... })` object, replace the hardcoded model line:

```ts
        model,
```

(Leave everything else in the file unchanged.)

- [ ] **Step 2: Verify it compiles and existing callers still work**

Run: `npx tsc --noEmit`
Expected: no errors. The existing 2-arg call in `src/lib/actions/lead-actions.ts` still type-checks (extra params are optional).

- [ ] **Step 3: Commit**

```bash
git add src/lib/claude.ts
git commit -m "feat: allow overriding the model in askClaude"
```

---

## Task 6: Content generator

**Files:**
- Create: `src/lib/content-generator.ts`
- Create: `tests/content-generator.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/content-generator.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parsePostVariants, buildSystemPrompt } from '@/lib/content-generator';

const SAMPLE = `===X===
Short x post #launch
===LINKEDIN===
A longer, professional LinkedIn update about the launch.
===FACEBOOK===
Friendly Facebook announcement.
===INSTAGRAM===
Caption with #hashtags`;

describe('parsePostVariants', () => {
  it('parses all requested platforms', () => {
    const result = parsePostVariants(SAMPLE, ['x', 'linkedin', 'facebook', 'instagram']);
    expect(result.x).toBe('Short x post #launch');
    expect(result.linkedin).toBe('A longer, professional LinkedIn update about the launch.');
    expect(result.facebook).toBe('Friendly Facebook announcement.');
    expect(result.instagram).toBe('Caption with #hashtags');
  });

  it('returns empty string for a requested platform missing from the response', () => {
    const text = `===X===\nonly x here`;
    const result = parsePostVariants(text, ['x', 'linkedin']);
    expect(result.x).toBe('only x here');
    expect(result.linkedin).toBe('');
  });

  it('only returns requested platforms, ignoring extra sections', () => {
    const result = parsePostVariants(SAMPLE, ['x']);
    expect(Object.keys(result)).toEqual(['x']);
    expect(result.x).toBe('Short x post #launch');
  });
});

describe('buildSystemPrompt', () => {
  it('includes the char limit for each requested platform', () => {
    const prompt = buildSystemPrompt(['x', 'linkedin'], 'casual');
    expect(prompt).toContain('280');
    expect(prompt).toContain('3000');
    expect(prompt).toContain('casual');
    expect(prompt).toContain('===X===');
    expect(prompt).toContain('===LINKEDIN===');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/content-generator.test.ts`
Expected: FAIL — cannot find module `@/lib/content-generator`.

- [ ] **Step 3: Implement the generator**

Create `src/lib/content-generator.ts`:

```ts
import { askClaude, isClaudeConfigured } from '@/lib/claude';
import { type Platform, PLATFORMS, PLATFORM_ORDER } from '@/lib/platforms';

const DELIMITERS: Record<Platform, string> = {
  x: '===X===',
  linkedin: '===LINKEDIN===',
  facebook: '===FACEBOOK===',
  instagram: '===INSTAGRAM===',
};

const PLATFORM_GUIDANCE: Record<Platform, string> = {
  x: 'concise and punchy, may use 1-2 hashtags',
  linkedin: 'professional and value-driven, can be a few short paragraphs',
  facebook: 'warm and conversational',
  instagram: 'an engaging caption ending with relevant hashtags',
};

export function buildSystemPrompt(platforms: Platform[], tone: string): string {
  const ordered = PLATFORM_ORDER.filter((p) => platforms.includes(p));
  const sections = ordered
    .map(
      (p) =>
        `${DELIMITERS[p]}\n[${PLATFORMS[p].label} post — ${PLATFORM_GUIDANCE[p]}; keep under ${PLATFORMS[p].charLimit} characters]`
    )
    .join('\n');

  const toneLine = tone.trim() ? `Tone/instructions: ${tone.trim()}` : 'Tone: professional but personable.';

  return `You are a social media copywriter for a freelance web developer promoting their own business.
Write one post per requested platform based on the user's idea. Tailor each to its platform.
${toneLine}

Respond using EXACTLY this format, with nothing before the first marker and no commentary:
${sections}

Replace each bracketed instruction with the actual post text. Keep each post within its character limit.`;
}

export function parsePostVariants(text: string, platforms: Platform[]): Record<Platform, string> {
  const markers = PLATFORM_ORDER.map((p) => ({ p, idx: text.indexOf(DELIMITERS[p]) }))
    .filter((m) => m.idx >= 0)
    .sort((a, b) => a.idx - b.idx);

  const result = {} as Record<Platform, string>;
  for (const p of platforms) result[p] = '';

  for (let i = 0; i < markers.length; i++) {
    const { p, idx } = markers[i];
    const start = idx + DELIMITERS[p].length;
    const end = i + 1 < markers.length ? markers[i + 1].idx : text.length;
    if (platforms.includes(p)) {
      result[p] = text.slice(start, end).trim();
    }
  }

  return result;
}

export async function generatePostVariants(input: {
  idea: string;
  platforms: Platform[];
  tone?: string;
}): Promise<{ variants: Record<Platform, string> } | { error: string }> {
  if (!isClaudeConfigured()) return { error: 'AI features are not configured.' };
  if (!input.idea.trim()) return { error: 'Enter an idea to generate from.' };
  if (input.platforms.length === 0) return { error: 'Select at least one platform.' };

  const system = buildSystemPrompt(input.platforms, input.tone ?? '');
  const response = await askClaude(system, input.idea, 2048, 'claude-sonnet-4-6');
  if (!response) return { error: 'Generation failed. Please try again.' };

  return { variants: parsePostVariants(response, input.platforms) };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/content-generator.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/content-generator.ts tests/content-generator.test.ts
git commit -m "feat: add AI content generator with per-platform parsing"
```

---

## Task 7: Publisher seam (Phase-2 interface + registry)

**Files:**
- Create: `src/lib/publishers/types.ts`
- Create: `src/lib/publishers/index.ts`

No live publishing in Phase 1 — this is only the interface and an empty registry so Phase-2 platform integrations drop in as single files.

- [ ] **Step 1: Create the interface**

Create `src/lib/publishers/types.ts`:

```ts
import type { Platform } from '@/lib/platforms';

export interface PublishInput {
  content: string;
  imagePath: string | null;
}

export interface PublishResult {
  platformPostId: string;
}

export interface Publisher {
  platform: Platform;
  isConfigured(): boolean;
  publish(input: PublishInput): Promise<PublishResult>;
}
```

- [ ] **Step 2: Create the registry**

Create `src/lib/publishers/index.ts`:

```ts
import type { Platform } from '@/lib/platforms';
import type { Publisher } from './types';

// Phase 1: empty. Each Phase-2 platform integration registers its Publisher here.
const registry: Partial<Record<Platform, Publisher>> = {};

export function getPublisher(platform: Platform): Publisher | undefined {
  return registry[platform];
}

export function isPlatformConfigured(platform: Platform): boolean {
  const publisher = registry[platform];
  return !!publisher && publisher.isConfigured();
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/publishers/types.ts src/lib/publishers/index.ts
git commit -m "feat: add publisher interface and registry seam"
```

---

## Task 8: Server actions

**Files:**
- Create: `src/lib/actions/post-actions.ts`

Validation is enforced client-side in `PostForm` (Task 11); the actions add lightweight guards (return early on clearly invalid input) consistent with existing actions like `updateRecurrenceDayAction`.

- [ ] **Step 1: Implement the actions**

Create `src/lib/actions/post-actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import {
  createPost,
  updatePost,
  deletePost,
  upsertVariant,
  setVariantStatus,
  syncPostPosted,
} from '@/lib/queries/post-queries';
import { generatePostVariants } from '@/lib/content-generator';
import { type Platform, PLATFORM_ORDER } from '@/lib/platforms';
import type { PostStatus } from '@/lib/types';

function readStatus(formData: FormData): PostStatus {
  const value = formData.get('status') as string;
  const allowed: PostStatus[] = ['draft', 'scheduled', 'posted', 'archived'];
  return allowed.includes(value as PostStatus) ? (value as PostStatus) : 'draft';
}

export async function createPostAction(formData: FormData) {
  const db = getDb();
  const title = ((formData.get('title') as string) || '').trim();
  if (!title) return;

  const variants = PLATFORM_ORDER.filter((p) => formData.get(`enabled_${p}`) === 'on').map((p) => ({
    platform: p as Platform,
    content: (formData.get(`content_${p}`) as string) || '',
    enabled: true,
  }));
  if (variants.length === 0) return;

  const id = createPost(db, {
    title,
    idea: ((formData.get('idea') as string) || '').trim() || null,
    image_path: (formData.get('image_path') as string) || null,
    status: readStatus(formData),
    scheduled_at: (formData.get('scheduled_at') as string) || null,
    variants,
  });

  revalidatePath('/content');
  redirect(`/content/${id}`);
}

export async function updatePostAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  const title = ((formData.get('title') as string) || '').trim();
  if (!id || !title) return;

  updatePost(db, id, {
    title,
    idea: ((formData.get('idea') as string) || '').trim() || null,
    image_path: (formData.get('image_path') as string) || null,
    status: readStatus(formData),
    scheduled_at: (formData.get('scheduled_at') as string) || null,
  });

  for (const p of PLATFORM_ORDER) {
    upsertVariant(db, id, p, {
      enabled: formData.get(`enabled_${p}`) === 'on',
      content: (formData.get(`content_${p}`) as string) || '',
    });
  }

  revalidatePath('/content');
  revalidatePath(`/content/${id}`);
  redirect(`/content/${id}`);
}

export async function deletePostAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  if (!id) return;
  deletePost(db, id);
  revalidatePath('/content');
  redirect('/content');
}

export async function markVariantPostedAction(formData: FormData) {
  const db = getDb();
  const variantId = Number(formData.get('variant_id'));
  const postId = Number(formData.get('post_id'));
  if (!variantId || !postId) return;

  setVariantStatus(db, variantId, 'posted', { published_at: new Date().toISOString() });
  syncPostPosted(db, postId);

  revalidatePath('/content');
  revalidatePath(`/content/${postId}`);
}

export async function generateVariantsAction(input: {
  idea: string;
  platforms: Platform[];
  tone: string;
}): Promise<{ variants: Record<Platform, string> } | { error: string }> {
  return generatePostVariants(input);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/post-actions.ts
git commit -m "feat: add post server actions"
```

---

## Task 9: Image upload + serve API routes

**Files:**
- Create: `src/app/api/content/image/route.ts`
- Create: `src/app/api/content/image/[filename]/route.ts`

Files are written to `data/uploads/` (gitignored), matching `src/app/api/documents/route.ts`. The post stores the generated `filename` in `image_path`; the UI references `/api/content/image/<filename>`.

- [ ] **Step 1: Implement the upload route**

Create `src/app/api/content/image/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
  }

  const ext = path.extname(file.name) || '';
  const filename = `${crypto.randomUUID()}${ext}`;

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, filename), Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({ filename });
}
```

- [ ] **Step 2: Implement the serve route**

Create `src/app/api/content/image/[filename]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  const safe = path.basename(filename); // prevents path traversal

  try {
    const buffer = await readFile(path.join(UPLOAD_DIR, safe));
    const type = MIME[path.extname(safe).toLowerCase()] || 'application/octet-stream';
    return new NextResponse(new Uint8Array(buffer), {
      headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=86400' },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual smoke test**

Ensure the dev server is running (`npx next dev -p 3004`). Then:

```bash
curl -s -F "file=@public/next.svg;type=image/svg+xml" http://localhost:3004/api/content/image
```

Expected: JSON `{ "filename": "<uuid>.svg" }`. Then `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3004/api/content/image/<uuid>.svg` returns `200`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/content/image/route.ts "src/app/api/content/image/[filename]/route.ts"
git commit -m "feat: add content image upload and serve routes"
```

---

## Task 10: Small components — PlatformBadge, CopyButton, PostImageUpload

**Files:**
- Create: `src/components/platform-badge.tsx`
- Create: `src/components/copy-button.tsx`
- Create: `src/components/post-image-upload.tsx`

- [ ] **Step 1: Create PlatformBadge**

Create `src/components/platform-badge.tsx`:

```tsx
import { type Platform, PLATFORMS } from '@/lib/platforms';

export function PlatformBadge({ platform }: { platform: Platform }) {
  const cfg = PLATFORMS[platform];
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-800 text-gray-300">
      <span className="font-bold">{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}
```

- [ ] **Step 2: Create CopyButton**

Create `src/components/copy-button.tsx`:

```tsx
'use client';

import { useState } from 'react';

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="px-3 py-1 text-xs text-gray-400 hover:text-white border border-gray-700 rounded hover:border-gray-600 transition-colors"
    >
      {copied ? 'Copied!' : label}
    </button>
  );
}
```

- [ ] **Step 3: Create PostImageUpload**

This is a **controlled** component — `PostForm` (Task 11) owns the image filename state so it can validate the Instagram-requires-image rule. The component renders the hidden `input[name="image_path"]` that the form submits.

Create `src/components/post-image-upload.tsx`:

```tsx
'use client';

import { useState } from 'react';

export function PostImageUpload({
  value,
  onChange,
}: {
  value: string;
  onChange: (filename: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/content/image', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Upload failed');
      else onChange(data.filename);
    } catch {
      setError('Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-400 mb-1">Image</label>
      <input type="hidden" name="image_path" value={value} />
      {value ? (
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/content/image/${value}`}
            alt="Post image"
            className="h-24 w-24 object-cover rounded-lg border border-gray-700"
          />
          <button type="button" onClick={() => onChange('')} className="text-xs text-red-400 hover:text-red-300">
            Remove
          </button>
        </div>
      ) : (
        <label className="inline-block px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 rounded-lg cursor-pointer transition-colors">
          {uploading ? 'Uploading...' : 'Upload Image'}
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      )}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/platform-badge.tsx src/components/copy-button.tsx src/components/post-image-upload.tsx
git commit -m "feat: add platform badge, copy button, and image upload components"
```

---

## Task 11: PostForm component

**Files:**
- Create: `src/components/post-form.tsx`

This is a client component. It manages per-platform `enabled`/`content` state to drive char counters and AI generation, includes a hidden `content_<platform>` input that always submits (so disabling a platform preserves its text), and disables the submit button until the form is valid (title present, ≥1 platform enabled, image present if Instagram is enabled).

- [ ] **Step 1: Implement the form**

Create `src/components/post-form.tsx`:

```tsx
'use client';

import { useState, useTransition } from 'react';
import { type Platform, PLATFORMS, PLATFORM_ORDER } from '@/lib/platforms';
import type { PostWithVariants } from '@/lib/types';
import { generateVariantsAction } from '@/lib/actions/post-actions';
import { PostImageUpload } from '@/components/post-image-upload';

const inputClass =
  'w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500';

interface PostFormProps {
  action: (formData: FormData) => Promise<void>;
  post?: PostWithVariants;
  submitLabel: string;
  aiConfigured: boolean;
}

function initialState(post?: PostWithVariants) {
  const enabled = {} as Record<Platform, boolean>;
  const content = {} as Record<Platform, string>;
  for (const p of PLATFORM_ORDER) {
    const variant = post?.variants.find((v) => v.platform === p);
    // New post: default all platforms enabled. Edit: reflect stored rows.
    enabled[p] = post ? !!variant && variant.enabled === 1 : true;
    content[p] = variant?.content ?? '';
  }
  return { enabled, content };
}

export function PostForm({ action, post, submitLabel, aiConfigured }: PostFormProps) {
  const init = initialState(post);
  const [title, setTitle] = useState(post?.title ?? '');
  const [idea, setIdea] = useState(post?.idea ?? '');
  const [enabled, setEnabled] = useState<Record<Platform, boolean>>(init.enabled);
  const [content, setContent] = useState<Record<Platform, string>>(init.content);
  const [image, setImage] = useState<string>(post?.image_path ?? '');
  const [tone, setTone] = useState('');
  const [aiError, setAiError] = useState('');
  const [pending, startTransition] = useTransition();

  const selectedPlatforms = PLATFORM_ORDER.filter((p) => enabled[p]);
  const instagramNeedsImage = enabled.instagram && !image;
  const canSubmit = title.trim().length > 0 && selectedPlatforms.length > 0 && !instagramNeedsImage;

  function handleGenerate() {
    setAiError('');
    startTransition(async () => {
      const result = await generateVariantsAction({ idea, platforms: selectedPlatforms, tone });
      if ('error' in result) {
        setAiError(result.error);
        return;
      }
      setContent((prev) => {
        const next = { ...prev };
        for (const p of selectedPlatforms) {
          if (result.variants[p]) next[p] = result.variants[p];
        }
        return next;
      });
    });
  }

  return (
    <form action={action} className="space-y-6">
      {post && <input type="hidden" name="id" value={post.id} />}

      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">
          Title <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          name="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Internal name for this post"
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">Idea</label>
        <textarea
          name="idea"
          rows={3}
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="What is this post about? Used as the seed for AI generation."
          className={inputClass}
        />
      </div>

      <PostImageUpload value={image} onChange={setImage} />

      <div className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <label className="block text-sm font-medium text-gray-400">Platforms</label>
          {aiConfigured && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                placeholder="Tone (optional)"
                className="px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-white w-40"
              />
              <button
                type="button"
                onClick={handleGenerate}
                disabled={pending || selectedPlatforms.length === 0 || !idea.trim()}
                className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:text-gray-400 text-white font-medium rounded-lg transition-colors"
              >
                {pending ? 'Generating...' : 'Generate with AI'}
              </button>
            </div>
          )}
        </div>

        {aiError && (
          <div className="p-3 bg-red-900/10 border border-red-900 rounded-lg text-sm text-red-400">
            {aiError}
          </div>
        )}

        {PLATFORM_ORDER.map((p) => {
          const cfg = PLATFORMS[p];
          const over = content[p].length > cfg.charLimit;
          return (
            <div key={p} className="border border-gray-800 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 text-sm font-medium text-white">
                  <input
                    type="checkbox"
                    name={`enabled_${p}`}
                    checked={enabled[p]}
                    onChange={(e) => setEnabled((prev) => ({ ...prev, [p]: e.target.checked }))}
                  />
                  <span className="font-bold">{cfg.icon}</span> {cfg.label}
                </label>
                <span className={`text-xs ${over ? 'text-red-400' : 'text-gray-500'}`}>
                  {content[p].length} / {cfg.charLimit}
                </span>
              </div>
              {/* Always submit content so disabling a platform preserves its text */}
              <textarea
                name={`content_${p}`}
                rows={3}
                value={content[p]}
                onChange={(e) => setContent((prev) => ({ ...prev, [p]: e.target.value }))}
                placeholder={`${cfg.label} post text`}
                className={`${inputClass} ${enabled[p] ? '' : 'hidden'}`}
              />
            </div>
          );
        })}

        {instagramNeedsImage && (
          <p className="text-xs text-red-400">Instagram requires an image. Upload one above.</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Status</label>
          <select name="status" defaultValue={post?.status ?? 'draft'} className={inputClass}>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="posted">Posted</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Scheduled date</label>
          <input
            type="date"
            name="scheduled_at"
            defaultValue={post?.scheduled_at ?? ''}
            className={inputClass}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:text-gray-400 text-white font-medium rounded-lg transition-colors"
      >
        {submitLabel}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/post-form.tsx
git commit -m "feat: add post compose/edit form with AI assist and char counters"
```

---

## Task 12: Pages (list, new, detail) + status badge colors

**Files:**
- Modify: `src/components/status-badge.tsx`
- Create: `src/app/(dashboard)/content/page.tsx`
- Create: `src/app/(dashboard)/content/new/page.tsx`
- Create: `src/app/(dashboard)/content/[id]/page.tsx`

- [ ] **Step 1: Add status colors**

In `src/components/status-badge.tsx`, add these keys to the `colors` map (keep existing entries):

```ts
  scheduled: 'bg-blue-500/20 text-blue-400',
  posted: 'bg-green-500/20 text-green-400',
  archived: 'bg-gray-500/20 text-gray-400',
```

- [ ] **Step 2: Create the list page**

Create `src/app/(dashboard)/content/page.tsx`:

```tsx
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { listPosts } from '@/lib/queries/post-queries';
import { PlatformBadge } from '@/components/platform-badge';
import { StatusBadge } from '@/components/status-badge';

const TABS = ['all', 'draft', 'scheduled', 'posted', 'archived'];

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = status || 'all';
  const db = getDb();
  const posts = listPosts(db, active);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Content</h2>
        <Link
          href="/content/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          New Post
        </Link>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map((tab) => (
          <Link
            key={tab}
            href={tab === 'all' ? '/content' : `/content?status=${tab}`}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${
              active === tab ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-800'
            }`}
          >
            {tab}
          </Link>
        ))}
      </div>

      {posts.length === 0 ? (
        <p className="text-gray-500">No posts yet. Create your first one.</p>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/content/${post.id}`}
              className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors"
            >
              <div className="min-w-0">
                <p className="font-medium text-white truncate">{post.title}</p>
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {post.platforms.map((p) => (
                    <PlatformBadge key={p} platform={p} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-3">
                {post.scheduled_at && (
                  <span className="text-xs text-gray-500">{post.scheduled_at}</span>
                )}
                <StatusBadge status={post.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create the new-post page**

Create `src/app/(dashboard)/content/new/page.tsx`:

```tsx
import Link from 'next/link';
import { PostForm } from '@/components/post-form';
import { createPostAction } from '@/lib/actions/post-actions';
import { isClaudeConfigured } from '@/lib/claude';

export default function NewPostPage() {
  return (
    <div className="p-4 sm:p-6 max-w-3xl">
      <Link href="/content" className="text-sm text-gray-400 hover:text-white mb-4 inline-block">
        &larr; Back to Content
      </Link>
      <h2 className="text-2xl font-bold mb-6">New Post</h2>
      <PostForm action={createPostAction} submitLabel="Create Post" aiConfigured={isClaudeConfigured()} />
    </div>
  );
}
```

- [ ] **Step 4: Create the detail/edit page**

Create `src/app/(dashboard)/content/[id]/page.tsx`:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getPostById } from '@/lib/queries/post-queries';
import { updatePostAction, deletePostAction, markVariantPostedAction } from '@/lib/actions/post-actions';
import { isClaudeConfigured } from '@/lib/claude';
import { PostForm } from '@/components/post-form';
import { PlatformBadge } from '@/components/platform-badge';
import { CopyButton } from '@/components/copy-button';

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const post = getPostById(db, Number(id));
  if (!post) notFound();

  const enabledVariants = post.variants.filter((v) => v.enabled === 1);

  return (
    <div className="p-4 sm:p-6 max-w-3xl">
      <Link href="/content" className="text-sm text-gray-400 hover:text-white mb-4 inline-block">
        &larr; Back to Content
      </Link>
      <h2 className="text-2xl font-bold mb-6">{post.title}</h2>

      <PostForm
        action={updatePostAction}
        post={post}
        submitLabel="Save Changes"
        aiConfigured={isClaudeConfigured()}
      />

      <div className="mt-10">
        <h3 className="text-sm font-medium text-gray-400 uppercase mb-3">Publish</h3>
        <p className="text-xs text-gray-500 mb-4">
          Copy each post and paste it into the network. Auto-publishing to platform APIs is coming in a
          future update.
        </p>
        {post.image_path && (
          <a
            href={`/api/content/image/${post.image_path}`}
            download
            className="inline-block mb-4 text-sm text-blue-400 hover:underline"
          >
            Download image
          </a>
        )}
        <div className="space-y-3">
          {enabledVariants.map((v) => (
            <div key={v.id} className="p-3 bg-gray-900 border border-gray-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <PlatformBadge platform={v.platform} />
                  {v.status === 'posted' && <span className="text-xs text-green-400">Posted</span>}
                </div>
                <div className="flex items-center gap-2">
                  <CopyButton text={v.content} />
                  {v.status !== 'posted' && (
                    <form action={markVariantPostedAction}>
                      <input type="hidden" name="variant_id" value={v.id} />
                      <input type="hidden" name="post_id" value={post.id} />
                      <button
                        type="submit"
                        className="px-3 py-1 text-xs text-gray-400 hover:text-white border border-gray-700 rounded hover:border-gray-600 transition-colors"
                      >
                        Mark posted
                      </button>
                    </form>
                  )}
                </div>
              </div>
              <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans">
                {v.content || <span className="text-gray-600">No content</span>}
              </pre>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 pt-6 border-t border-gray-800">
        <form action={deletePostAction}>
          <input type="hidden" name="id" value={post.id} />
          <button type="submit" className="text-sm text-red-400 hover:text-red-300">
            Delete post
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/status-badge.tsx "src/app/(dashboard)/content"
git commit -m "feat: add content list, compose, and detail pages"
```

---

## Task 13: Navigation

**Files:**
- Modify: `src/components/sidebar.tsx`
- Modify: `src/components/mobile-nav.tsx`

- [ ] **Step 1: Add the sidebar item**

In `src/components/sidebar.tsx`, add to the `navItems` array, between the Automations and Settings entries:

```ts
  { href: '/content', label: 'Content', icon: '✎' },
```

- [ ] **Step 2: Add the mobile-nav item**

In `src/components/mobile-nav.tsx`, add to the `moreItems` array (e.g., after the Automations entry):

```ts
  { href: '/content', label: 'Content', icon: '✎' },
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/sidebar.tsx src/components/mobile-nav.tsx
git commit -m "feat: add Content nav item to sidebar and mobile nav"
```

---

## Task 14: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including `tests/platforms.test.ts`, `tests/queries/post-queries.test.ts`, `tests/content-generator.test.ts`, and the pre-existing suites.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds; `/content`, `/content/new`, `/content/[id]` appear in the route output.

- [ ] **Step 4: Manual browser verification**

Start the dev server (`npx next dev -p 3004`) and verify at `http://localhost:3004`:
- "Content" appears in the sidebar and navigates to `/content`.
- "New Post" → fill title, idea, check all four platforms; char counter increments and turns red past a platform's limit (paste a long string into X).
- Upload an image; the preview renders.
- If `ANTHROPIC_API_KEY` is set: "Generate with AI" fills the enabled textareas. If not set, the button is hidden (form still works manually).
- Submit is disabled until title + ≥1 platform are present, and (if Instagram is checked) an image is uploaded.
- Save → redirected to the detail page; per-variant Copy works; "Mark posted" flips the variant to Posted; once all enabled variants are posted, the list shows the post as `posted`.
- Status filter tabs on `/content` filter correctly.
- Delete removes the post and returns to the list.

If anything fails, fix it before committing. UI behavior cannot be confirmed by type-checks alone — actually exercise each path in the browser.

- [ ] **Step 5: Final commit (if any fixes were made)**

```bash
git add -A
git commit -m "fix: address content-creation verification issues"
```

---

## Self-Review Notes (for the executor)

- **Spec coverage:** posts/post_variants schema (Task 2), platform config (Task 1), queries incl. roll-up (Tasks 3–4), AI generation + model bump (Tasks 5–6), publisher seam (Task 7), actions (Task 8), image upload (Task 9), UI (Tasks 10–12), nav (Task 13), tests (Tasks 1–4, 6), validation rules (Task 11). The spec's `publishPostAction` is intentionally **not** implemented in Phase 1 (it would be dead code with an empty registry); the seam is the `Publisher` interface + registry (Task 7), and the detail page shows a "coming soon" note instead. This is the only intentional deviation from the spec.
- **Type consistency:** `Platform`, `PostStatus`, `VariantStatus`, `PostWithVariants`, and the query function names (`createPost`, `getPostById`, `listPosts`, `updatePost`, `deletePost`, `upsertVariant`, `setVariantStatus`, `syncPostPosted`) are used identically across tasks.
- **Char limits** are sourced only from `src/lib/platforms.ts` — the counter, validation, and AI prompt all read from it.
