# Auto-draft Generated Social Posts to Buffer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-create a Buffer **draft** whenever a social post is generated (LinkedIn/X/Facebook), plus a backfill button to push older social generations — drafts only, best-effort, never breaking generation.

**Architecture:** A single reusable helper `draftGenerationToBuffer(contentType, text)` encapsulates the configured-check → content-type→platform map → channel lookup → `createPost(saveToDraft:true)`. The `/api/generate` route calls it after saving a generation; a new `/api/generate/backfill-buffer` route calls it in a loop. A `buffer_post_id` column on `generations` records what's been pushed (idempotency + UI badge).

**Tech Stack:** Next.js 16 (App Router), TypeScript, better-sqlite3, vitest (tests in `tests/`, `@`→`src`), Tailwind. Builds on the existing `src/lib/buffer/` integration (live).

**Spec:** `docs/superpowers/specs/2026-06-25-generate-auto-draft-buffer-design.md`

## Verified facts (probed live 2026-06-25)
- `createPost({ ..., mode:'addToQueue', saveToDraft:true })` with **no** `dueAt` → returns `status:"draft", dueAt:null`. This is the exact draft call.
- Buffer `posts()` default query returns draft posts, so drafts appear in `/social`.
- Connected channels: `linkedin`, `twitter`(→platform `x`), `facebook`. Org in env.

## Content types (from `src/lib/types.ts`)
`GenContentType = blog_article | email | email_sequence | campaign_plan | social_linkedin | social_twitter | social_facebook`. Only the three `social_*` map to a Buffer channel.

---

### Task 1: `createPost` accepts `saveToDraft`

**Files:**
- Modify: `src/lib/buffer/queries.ts`
- Test: `tests/buffer/queries.test.ts` (add one test)

- [ ] **Step 1: Add a failing test** — append inside the existing `describe('buffer queries', ...)` block in `tests/buffer/queries.test.ts`:

```typescript
  it('createPost forwards saveToDraft when set', async () => {
    mockGql.mockResolvedValue({ createPost: { __typename: 'PostActionSuccess', post: {
      id: 'd1', status: 'draft', text: 'hi', dueAt: null, sentAt: null,
      channelId: 'c1', channelService: 'twitter', shareMode: 'addToQueue',
      externalLink: null, allowedActions: [],
    } } });
    const post = await createPost({ channelId: 'c1', text: 'hi', mode: 'addToQueue', saveToDraft: true });
    expect(post.status).toBe('draft');
    expect(mockGql.mock.calls[0][1].i.saveToDraft).toBe(true);
  });

  it('createPost omits saveToDraft when not set', async () => {
    mockGql.mockResolvedValue({ createPost: { __typename: 'PostActionSuccess', post: {
      id: 'd2', status: 'scheduled', text: 'hi', dueAt: null, sentAt: null,
      channelId: 'c1', channelService: 'twitter', shareMode: 'addToQueue',
      externalLink: null, allowedActions: [],
    } } });
    await createPost({ channelId: 'c1', text: 'hi', mode: 'addToQueue' });
    expect('saveToDraft' in mockGql.mock.calls[0][1].i).toBe(false);
  });
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run tests/buffer/queries.test.ts`
Expected: FAIL (saveToDraft not forwarded / undefined).

- [ ] **Step 3: Implement** — in `src/lib/buffer/queries.ts`, change the `createPost` signature and input. Replace the existing `createPost` function with:

```typescript
export async function createPost(args: { channelId: string; text: string; mode: ShareMode; dueAt?: string; saveToDraft?: boolean }): Promise<BufferPost> {
  const data = await bufferGql<{ createPost: { __typename: string; post?: RawPost; message?: string } }>(
    `mutation($i:CreatePostInput!){ createPost(input:$i){ ${POST_ACTION_RESULT} } }`,
    { i: {
      channelId: args.channelId,
      text: args.text,
      schedulingType: 'automatic',
      mode: args.mode,
      ...(args.dueAt ? { dueAt: args.dueAt } : {}),
      ...(args.saveToDraft ? { saveToDraft: true } : {}),
      assets: [],
      source: 'commandpost',
    } },
  );
  return unwrapPostAction(data.createPost);
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run tests/buffer/queries.test.ts`
Expected: PASS (all prior tests + 2 new).

- [ ] **Step 5: Commit**

```bash
cd /Users/philipsmith/commandpost
git add src/lib/buffer/queries.ts tests/buffer/queries.test.ts
git commit -m "feat(buffer): createPost supports saveToDraft"
```

---

### Task 2: `socialContentTypeToPlatform` mapping

**Files:**
- Modify: `src/lib/buffer/map.ts`
- Test: `tests/buffer/map.test.ts` (add a describe block)

- [ ] **Step 1: Add a failing test** — append to `tests/buffer/map.test.ts`:

```typescript
import { socialContentTypeToPlatform } from '@/lib/buffer/map';

describe('socialContentTypeToPlatform', () => {
  it('maps the three social content types to platforms', () => {
    expect(socialContentTypeToPlatform('social_linkedin')).toBe('linkedin');
    expect(socialContentTypeToPlatform('social_twitter')).toBe('x');
    expect(socialContentTypeToPlatform('social_facebook')).toBe('facebook');
  });

  it('returns null for non-social content types', () => {
    expect(socialContentTypeToPlatform('blog_article')).toBeNull();
    expect(socialContentTypeToPlatform('email')).toBeNull();
    expect(socialContentTypeToPlatform('email_sequence')).toBeNull();
    expect(socialContentTypeToPlatform('campaign_plan')).toBeNull();
  });
});
```
(Add `socialContentTypeToPlatform` to the existing top import from `@/lib/buffer/map` rather than a second import line if you prefer; a separate import also works.)

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run tests/buffer/map.test.ts`
Expected: FAIL (not exported).

- [ ] **Step 3: Implement** — append to `src/lib/buffer/map.ts`:

```typescript
import type { GenContentType } from '@/lib/types';

// Generate's social content types → CommandPost Platform. Non-social → null.
export function socialContentTypeToPlatform(contentType: GenContentType): Platform | null {
  switch (contentType) {
    case 'social_linkedin': return 'linkedin';
    case 'social_twitter': return 'x';
    case 'social_facebook': return 'facebook';
    default: return null;
  }
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run tests/buffer/map.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/buffer/map.ts tests/buffer/map.test.ts
git commit -m "feat(buffer): map social content types to platforms"
```

---

### Task 3: `draftGenerationToBuffer` helper

**Files:**
- Create: `src/lib/buffer/draft.ts`
- Test: `tests/buffer/draft.test.ts`

- [ ] **Step 1: Write the failing test** — `tests/buffer/draft.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/buffer/client', () => ({ isBufferConfigured: vi.fn() }));
vi.mock('@/lib/buffer/queries', () => ({ listChannels: vi.fn(), createPost: vi.fn() }));

import { isBufferConfigured } from '@/lib/buffer/client';
import { listChannels, createPost } from '@/lib/buffer/queries';
import { draftGenerationToBuffer } from '@/lib/buffer/draft';

const CHANNELS = [
  { id: 'li', service: 'linkedin', name: 'LI', platform: 'linkedin' },
  { id: 'tw', service: 'twitter', name: 'X acct', platform: 'x' },
];

describe('draftGenerationToBuffer', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns not_social for non-social content', async () => {
    const r = await draftGenerationToBuffer('blog_article', 'hello');
    expect(r).toEqual({ pushed: false, reason: 'not_social' });
    expect(createPost).not.toHaveBeenCalled();
  });

  it('returns not_configured when Buffer is off', async () => {
    vi.mocked(isBufferConfigured).mockReturnValue(false);
    const r = await draftGenerationToBuffer('social_twitter', 'hi');
    expect(r).toEqual({ pushed: false, reason: 'not_configured' });
  });

  it('returns no_channel when target platform is not connected', async () => {
    vi.mocked(isBufferConfigured).mockReturnValue(true);
    vi.mocked(listChannels).mockResolvedValue(CHANNELS as never);
    const r = await draftGenerationToBuffer('social_facebook', 'hi'); // no facebook channel
    expect(r).toEqual({ pushed: false, reason: 'no_channel' });
  });

  it('creates a draft on the matching channel and returns pushed', async () => {
    vi.mocked(isBufferConfigured).mockReturnValue(true);
    vi.mocked(listChannels).mockResolvedValue(CHANNELS as never);
    vi.mocked(createPost).mockResolvedValue({ id: 'p9' } as never);
    const r = await draftGenerationToBuffer('social_twitter', 'hi');
    expect(r).toEqual({ pushed: true, postId: 'p9', channel: 'X acct' });
    expect(createPost).toHaveBeenCalledWith({ channelId: 'tw', text: 'hi', mode: 'addToQueue', saveToDraft: true });
  });

  it('returns error (non-throwing) when Buffer call fails', async () => {
    vi.mocked(isBufferConfigured).mockReturnValue(true);
    vi.mocked(listChannels).mockRejectedValue(new Error('boom'));
    const r = await draftGenerationToBuffer('social_linkedin', 'hi');
    expect(r).toMatchObject({ pushed: false, reason: 'error' });
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run tests/buffer/draft.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — `src/lib/buffer/draft.ts`:

```typescript
import { isBufferConfigured } from './client';
import { listChannels, createPost } from './queries';
import { socialContentTypeToPlatform } from './map';
import type { GenContentType } from '@/lib/types';

export type DraftResult =
  | { pushed: true; postId: string; channel: string }
  | { pushed: false; reason: 'not_social' | 'not_configured' | 'no_channel' | 'error'; message?: string };

// Best-effort: never throws. Creates a Buffer DRAFT for a social generation.
export async function draftGenerationToBuffer(contentType: GenContentType, text: string): Promise<DraftResult> {
  const platform = socialContentTypeToPlatform(contentType);
  if (!platform) return { pushed: false, reason: 'not_social' };
  if (!isBufferConfigured()) return { pushed: false, reason: 'not_configured' };
  try {
    const channels = await listChannels();
    const channel = channels.find((c) => c.platform === platform);
    if (!channel) return { pushed: false, reason: 'no_channel' };
    const post = await createPost({ channelId: channel.id, text, mode: 'addToQueue', saveToDraft: true });
    return { pushed: true, postId: post.id, channel: channel.name };
  } catch (err) {
    return { pushed: false, reason: 'error', message: err instanceof Error ? err.message : 'Buffer error' };
  }
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run tests/buffer/draft.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/buffer/draft.ts tests/buffer/draft.test.ts
git commit -m "feat(buffer): draftGenerationToBuffer helper (best-effort draft push)"
```

---

### Task 4: `buffer_post_id` column + generation queries

**Files:**
- Modify: `src/lib/db.ts` (add migration)
- Modify: `src/lib/types.ts` (Generation type)
- Modify: `src/lib/queries/generation-queries.ts`
- Test: `tests/queries/generation-queries.test.ts` (create)

- [ ] **Step 1: Write the failing test** — `tests/queries/generation-queries.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { initDb } from '@/lib/db';
import {
  createGeneration,
  getGeneration,
  setGenerationBufferPostId,
  listUnpushedSocialGenerations,
} from '@/lib/queries/generation-queries';
import type Database from 'better-sqlite3';

let db: Database.Database;
beforeEach(() => { db = initDb(':memory:'); });

function mk(content_type: 'social_twitter' | 'blog_article', topic = 't') {
  return createGeneration(db, {
    content_type, topic, length: 'medium', source_ids: [], retrieval_mode: 'none', result: 'body',
  });
}

describe('generation buffer_post_id', () => {
  it('defaults buffer_post_id to null and sets it', () => {
    const id = mk('social_twitter');
    expect(getGeneration(db, id)!.buffer_post_id).toBeNull();
    setGenerationBufferPostId(db, id, 'bp_1');
    expect(getGeneration(db, id)!.buffer_post_id).toBe('bp_1');
  });

  it('listUnpushedSocialGenerations returns only unpushed social rows', () => {
    const social = mk('social_twitter');
    mk('blog_article');                 // non-social → excluded
    const pushed = mk('social_twitter');
    setGenerationBufferPostId(db, pushed, 'bp_2');
    const rows = listUnpushedSocialGenerations(db);
    expect(rows.map((r) => r.id)).toEqual([social]);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run tests/queries/generation-queries.test.ts`
Expected: FAIL (functions/column missing).

- [ ] **Step 3a: Add the migration** — in `src/lib/db.ts`, immediately after the existing avatar_id migration block (the one that does `ALTER TABLE generations ADD COLUMN avatar_id INTEGER`), add:

```typescript
  // Migration: add buffer_post_id to generations (auto-draft to Buffer)
  const hasGenBufferId = db
    .prepare("SELECT COUNT(*) as count FROM pragma_table_info('generations') WHERE name = 'buffer_post_id'")
    .get() as { count: number };
  if (hasGenBufferId.count === 0) {
    db.exec('ALTER TABLE generations ADD COLUMN buffer_post_id TEXT');
  }
```

- [ ] **Step 3b: Extend the Generation type** — in `src/lib/types.ts`, add to the `Generation` interface (after `result: string;`):

```typescript
  buffer_post_id: string | null;
```

- [ ] **Step 3c: Add the queries** — in `src/lib/queries/generation-queries.ts`, append:

```typescript
export function setGenerationBufferPostId(db: Database.Database, id: number, bufferPostId: string): void {
  db.prepare('UPDATE generations SET buffer_post_id = ? WHERE id = ?').run(bufferPostId, id);
}

export function listUnpushedSocialGenerations(db: Database.Database): Generation[] {
  return db
    .prepare(
      `SELECT * FROM generations
       WHERE buffer_post_id IS NULL
         AND content_type IN ('social_linkedin', 'social_twitter', 'social_facebook')
       ORDER BY created_at DESC, id DESC LIMIT 100`
    )
    .all() as Generation[];
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run tests/queries/generation-queries.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts src/lib/types.ts src/lib/queries/generation-queries.ts tests/queries/generation-queries.test.ts
git commit -m "feat(generate): buffer_post_id column + generation queries"
```

---

### Task 5: `/api/generate` auto-drafts on social generations

**Files:**
- Modify: `src/app/api/generate/route.ts`
- Test: `tests/api/generate-autodraft.test.ts`

- [ ] **Step 1: Write the failing test** — `tests/api/generate-autodraft.test.ts`. This tests the auto-push wiring in isolation by mocking the heavy deps:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({ getDb: () => ({}) }));
vi.mock('@/lib/rag/retrieve', () => ({ retrieveContext: vi.fn().mockResolvedValue({ chunks: [], mode: 'none' }) }));
vi.mock('@/lib/generation/generate', () => ({ generateContent: vi.fn().mockResolvedValue({ ok: true, text: 'GENERATED' }) }));
vi.mock('@/lib/queries/master-queries', () => ({ getMasterProfile: () => null }));
vi.mock('@/lib/queries/avatar-queries', () => ({ getAvatar: vi.fn(), listAvatars: vi.fn().mockReturnValue([]) }));
vi.mock('@/lib/generation/audience', () => ({ composeAudience: () => undefined }));
vi.mock('@/lib/queries/generation-queries', () => ({ createGeneration: vi.fn().mockReturnValue(42), setGenerationBufferPostId: vi.fn() }));
vi.mock('@/lib/buffer/draft', () => ({ draftGenerationToBuffer: vi.fn() }));

import { setGenerationBufferPostId } from '@/lib/queries/generation-queries';
import { draftGenerationToBuffer } from '@/lib/buffer/draft';
import { POST } from '@/app/api/generate/route';

function req(body: unknown) {
  return new NextRequest(new Request('http://localhost/api/generate', {
    method: 'POST', body: JSON.stringify(body),
  }));
}

describe('POST /api/generate auto-draft', () => {
  beforeEach(() => vi.clearAllMocks());

  it('records buffer_post_id and returns buffer:{pushed} for a social generation', async () => {
    vi.mocked(draftGenerationToBuffer).mockResolvedValue({ pushed: true, postId: 'bp_9', channel: 'X acct' });
    const res = await POST(req({ contentType: 'social_twitter', topic: 'hi' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(draftGenerationToBuffer).toHaveBeenCalledWith('social_twitter', 'GENERATED');
    expect(setGenerationBufferPostId).toHaveBeenCalledWith(expect.anything(), 42, 'bp_9');
    expect(body.buffer).toEqual({ pushed: true, channel: 'X acct' });
  });

  it('still returns 200 with buffer:{pushed:false} when the push is skipped/fails', async () => {
    vi.mocked(draftGenerationToBuffer).mockResolvedValue({ pushed: false, reason: 'no_channel' });
    const res = await POST(req({ contentType: 'social_facebook', topic: 'hi' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(setGenerationBufferPostId).not.toHaveBeenCalled();
    expect(body.buffer).toEqual({ pushed: false, reason: 'no_channel' });
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run tests/api/generate-autodraft.test.ts`
Expected: FAIL (route doesn't call draftGenerationToBuffer / no `buffer` in response).

- [ ] **Step 3: Implement** — in `src/app/api/generate/route.ts`:

3a. Add imports near the existing imports:

```typescript
import { setGenerationBufferPostId } from '@/lib/queries/generation-queries';
import { draftGenerationToBuffer } from '@/lib/buffer/draft';
```
(Note: `createGeneration` is already imported from `@/lib/queries/generation-queries` — extend that existing import line to also include `setGenerationBufferPostId` instead of adding a duplicate import.)

3b. Replace the final `return NextResponse.json({ ... })` block with:

```typescript
  // Auto-draft social generations to Buffer (best-effort; never fails the generation).
  const draft = await draftGenerationToBuffer(contentType, gen.text);
  let buffer: { pushed: true; channel: string } | { pushed: false; reason: string };
  if (draft.pushed) {
    setGenerationBufferPostId(db, id, draft.postId);
    buffer = { pushed: true, channel: draft.channel };
  } else {
    buffer = { pushed: false, reason: draft.reason };
  }

  return NextResponse.json({
    id,
    result: gen.text,
    retrieval_mode: mode,
    sources_used: chunks.length,
    buffer,
  });
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run tests/api/generate-autodraft.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/generate/route.ts" tests/api/generate-autodraft.test.ts
git commit -m "feat(generate): auto-draft social generations to Buffer"
```

---

### Task 6: `/api/generate/backfill-buffer` route

**Files:**
- Create: `src/app/api/generate/backfill-buffer/route.ts`
- Test: `tests/api/generate-backfill.test.ts`

- [ ] **Step 1: Write the failing test** — `tests/api/generate-backfill.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({ getDb: () => ({}) }));
vi.mock('@/lib/buffer/client', () => ({ isBufferConfigured: vi.fn() }));
vi.mock('@/lib/queries/generation-queries', () => ({
  listUnpushedSocialGenerations: vi.fn(),
  setGenerationBufferPostId: vi.fn(),
}));
vi.mock('@/lib/buffer/draft', () => ({ draftGenerationToBuffer: vi.fn() }));

import { isBufferConfigured } from '@/lib/buffer/client';
import { listUnpushedSocialGenerations, setGenerationBufferPostId } from '@/lib/queries/generation-queries';
import { draftGenerationToBuffer } from '@/lib/buffer/draft';
import { POST } from '@/app/api/generate/backfill-buffer/route';

describe('POST /api/generate/backfill-buffer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('400s when Buffer is not configured', async () => {
    vi.mocked(isBufferConfigured).mockReturnValue(false);
    const res = await POST();
    expect(res.status).toBe(400);
    expect(listUnpushedSocialGenerations).not.toHaveBeenCalled();
  });

  it('pushes eligible generations and tallies pushed/skipped/failed', async () => {
    vi.mocked(isBufferConfigured).mockReturnValue(true);
    vi.mocked(listUnpushedSocialGenerations).mockReturnValue([
      { id: 1, content_type: 'social_twitter', result: 'a' },
      { id: 2, content_type: 'social_facebook', result: 'b' },
      { id: 3, content_type: 'social_linkedin', result: 'c' },
    ] as never);
    vi.mocked(draftGenerationToBuffer)
      .mockResolvedValueOnce({ pushed: true, postId: 'bp1', channel: 'X' })
      .mockResolvedValueOnce({ pushed: false, reason: 'no_channel' })
      .mockResolvedValueOnce({ pushed: false, reason: 'error', message: 'boom' });
    const res = await POST();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ pushed: 1, skipped: 1, failed: 1 });
    expect(setGenerationBufferPostId).toHaveBeenCalledTimes(1);
    expect(setGenerationBufferPostId).toHaveBeenCalledWith(expect.anything(), 1, 'bp1');
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run tests/api/generate-backfill.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — `src/app/api/generate/backfill-buffer/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { isBufferConfigured } from '@/lib/buffer/client';
import { listUnpushedSocialGenerations, setGenerationBufferPostId } from '@/lib/queries/generation-queries';
import { draftGenerationToBuffer } from '@/lib/buffer/draft';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST() {
  if (!isBufferConfigured()) {
    return NextResponse.json({ error: 'Buffer is not configured' }, { status: 400 });
  }
  const db = getDb();
  const generations = listUnpushedSocialGenerations(db);

  let pushed = 0;
  let skipped = 0;
  let failed = 0;
  for (const g of generations) {
    const result = await draftGenerationToBuffer(g.content_type, g.result);
    if (result.pushed) {
      setGenerationBufferPostId(db, g.id, result.postId);
      pushed += 1;
    } else if (result.reason === 'no_channel' || result.reason === 'not_social') {
      skipped += 1;
    } else {
      failed += 1;
    }
  }
  return NextResponse.json({ pushed, skipped, failed });
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run tests/api/generate-backfill.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/generate/backfill-buffer/route.ts" tests/api/generate-backfill.test.ts
git commit -m "feat(generate): backfill-buffer route pushes unpushed social generations"
```

---

### Task 7: History UI — "In Buffer" badge + backfill button

**Files:**
- Modify: `src/components/generate-studio.tsx`

UI task — verify manually. The component is a client component with `history: Generation[]` state, a `refreshHistory()` that GETs `/api/generate/history`, and a History section (around the `{/* History */}` comment) mapping `history` to rows with an `openHistory`/`deleteHistory` button pair.

- [ ] **Step 1: Add backfill state + handler** — inside the `GenerateStudio` component, near the other `useState`/handlers (e.g. just after `refreshHistory`), add:

```tsx
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);

  async function backfillToBuffer() {
    setBackfilling(true);
    setBackfillMsg(null);
    const res = await fetch('/api/generate/backfill-buffer', { method: 'POST' });
    const body = await res.json();
    setBackfilling(false);
    if (!res.ok) { setBackfillMsg(body.error ?? 'Backfill failed'); return; }
    setBackfillMsg(`Pushed ${body.pushed}, skipped ${body.skipped}${body.failed ? `, failed ${body.failed}` : ''}`);
    refreshHistory();
  }
```

- [ ] **Step 2: Add the button next to the History heading** — find the History heading line:

```tsx
            <h3 className="text-sm font-semibold text-gray-300 mb-3">History</h3>
```
Replace it with:

```tsx
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-300">History</h3>
              <div className="flex items-center gap-2">
                {backfillMsg && <span className="text-xs text-gray-500">{backfillMsg}</span>}
                <button onClick={backfillToBuffer} disabled={backfilling}
                  className="text-xs px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 transition-colors">
                  {backfilling ? 'Sending…' : 'Send social to Buffer'}
                </button>
              </div>
            </div>
```

- [ ] **Step 3: Add the badge on pushed social items** — find the history row's type/date line:

```tsx
                  <p className="text-xs text-gray-500">{typeLabel(g.content_type)} · {g.created_at}</p>
```
Replace it with:

```tsx
                  <p className="text-xs text-gray-500">
                    {typeLabel(g.content_type)} · {g.created_at}
                    {g.buffer_post_id && (
                      <span className="ml-2 px-1.5 py-0.5 rounded bg-green-900 text-green-300">In Buffer (draft)</span>
                    )}
                  </p>
```

- [ ] **Step 4: Lint + typecheck**

Run: `cd /Users/philipsmith/commandpost && npx eslint src/components/generate-studio.tsx && npx tsc --noEmit`
Expected: clean (no errors in this file).

- [ ] **Step 5: Manual verify**

Run `npm run dev`, open `http://localhost:3019/generate` (use a free port if 3019 is busy). Generate a LinkedIn/X/Facebook post → it should get an "In Buffer (draft)" badge and appear on `/social` with status "draft". Click "Send social to Buffer" → older social items get pushed; message shows counts. Generate a Blog Article → no badge, not pushed.

- [ ] **Step 6: Commit**

```bash
git add src/components/generate-studio.tsx
git commit -m "feat(generate): history shows Buffer-draft badge + Send-to-Buffer backfill"
```

---

### Task 8: Full test + lint pass, push

- [ ] **Step 1: Whole suite**

Run: `npm test`
Expected: all pass (existing 190 + the new buffer/draft, generation-queries, generate-autodraft, generate-backfill tests).

- [ ] **Step 2: Lint the changed files** (repo has some pre-existing debt in unrelated files; keep OUR files clean)

Run: `npx eslint src/lib/buffer/draft.ts src/lib/buffer/map.ts src/lib/buffer/queries.ts src/lib/queries/generation-queries.ts "src/app/api/generate/route.ts" "src/app/api/generate/backfill-buffer/route.ts" src/components/generate-studio.tsx src/lib/db.ts src/lib/types.ts`
Expected: no errors.

- [ ] **Step 3: Build sanity (optional, local)**

Run: `npm run build`
Expected: succeeds. (Do NOT run concurrently with a server deploy build.)

- [ ] **Step 4: Push**

```bash
git push -u origin feat/generate-auto-draft-buffer
```

---

## Deploy (after merge — separate step)
- Additive migration (`ADD COLUMN buffer_post_id`) runs automatically on app start via `initDb`/`getDb`. No cold `.next` wipe, no new npm deps.
- Standard deploy: merge to `main`, then on the server `git pull` (or the new `fix(deploy)` hard-reset) + build + `pm2 restart commandpost`.

## Self-review notes
- **Spec coverage:** social-only mapping (Task 2), draft via saveToDraft (Tasks 1+3), auto-on-generate (Task 5), backfill button + route (Tasks 6+7), `buffer_post_id` idempotency column (Task 4), best-effort/non-fatal (Task 3 catch + Task 5 always-200), drafts visible on /social (verified, no code needed), "In Buffer" badge (Task 7), skip non-social/no-channel (Task 3 + backfill tally). Testing per spec (unit + route, Buffer mocked).
- **Type consistency:** `draftGenerationToBuffer(contentType, text) → DraftResult` used identically in Tasks 5 and 6; `setGenerationBufferPostId(db, id, postId)` and `listUnpushedSocialGenerations(db)` consistent across Tasks 4/5/6; `Generation.buffer_post_id: string | null` (Task 4) consumed by the UI badge (Task 7); `socialContentTypeToPlatform` (Task 2) used by `draft.ts` (Task 3).
- **No placeholders:** every step has runnable code/commands.
