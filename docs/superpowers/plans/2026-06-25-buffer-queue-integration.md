# Buffer Queue Integration — Implementation Plan (Phase 1 + 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let CommandPost read and manage the user's live Buffer posting queue (list, create, reschedule, edit, delete) from a `/social` cockpit page, with Buffer as the single source of truth.

**Architecture:** A small server-side Buffer GraphQL client (`src/lib/buffer/`) + thin proxy API routes (`/api/social/*`) that keep the API key server-only + a `/social` client page. No local posts table — every view calls Buffer live (Approach A from the spec).

**Tech Stack:** Next.js 16 (App Router), TypeScript, vitest (tests in `tests/`, `@`→`src` alias), Buffer GraphQL API (`https://api.buffer.com`), Tailwind dark theme.

**Spec:** `docs/superpowers/specs/2026-06-25-buffer-queue-integration-design.md`

**Scope notes:**
- This plan = **Phase 1 (foundation + Settings panel)** and **Phase 2 (`/social` cockpit)**. Phase 3 (Calendar overlay) and Phase 4 (Generate "Send to Buffer" button) are deferred to their own plans.
- The spec's optional `BufferPublisher` registry adapter is **intentionally skipped** — nothing consumes `getPublisher()` yet; the cockpit and routes call the Buffer queries directly. The empty `src/lib/publishers/` registry is left untouched.
- v1 is **text-only** (`assets: []`). Image attach is a later phase.

## Verified Buffer API contract (probed live 2026-06-25)

- Endpoint `https://api.buffer.com`, header `Authorization: Bearer ${BUFFER_API_KEY}`.
- Env: `BUFFER_API_KEY`, `BUFFER_ORG_ID` (= `6a3d74bed4c230629f229a87`). Already in local `.env`.
- `channels(input:{organizationId:OrganizationId!}) → { id, service, name }`. Services seen: `facebook`, `linkedin`, `twitter`.
- `posts(input:PostsInput!, first:Int) → { edges { node { ...Post } } }`. `PostsInput = { organizationId!, filter:{ channelIds, status, tags, dueAt, createdAt }, sort }`.
- `createPost(input:CreatePostInput!) → PostActionPayload` (union). Required input: `channelId:ChannelId!`, `schedulingType:SchedulingType!` (`automatic`|`notification` → use `automatic`), `mode:ShareMode!` (`addToQueue`|`shareNow`|`shareNext`|`customScheduled`), `assets:[…!]!` (use `[]` for text). Optional: `text`, `dueAt:DateTime`, `source`, `saveToDraft`.
- `editPost(input:EditPostInput!) → PostActionPayload`. Same as create + `id:PostId!`. `mode` and `schedulingType` are **required** on edit too.
- `deletePost(input:DeletePostInput!) → DeletePostPayload` (union). Input `{ id:PostId! }`.
- **Union return shapes** (must use inline fragments):
  - `PostActionPayload` = `PostActionSuccess { post }` | `RestProxyError { message code }` | `InvalidInputError { message }` | `LimitReachedError { message }` | `UnauthorizedError { message }` | `NotFoundError { message }` | `UnexpectedError { message }`.
  - `DeletePostPayload` = `DeletePostSuccess { id }` | `VoidMutationError { message }`.
- `Post` node fields used: `id, status, text, dueAt, sentAt, channelId, channelService, shareMode, externalLink, allowedActions`.

---

### Task 1: Buffer types + service↔platform mapping

**Files:**
- Create: `src/lib/buffer/types.ts`
- Create: `src/lib/buffer/map.ts`
- Test: `tests/buffer/map.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/buffer/map.test.ts
import { describe, it, expect } from 'vitest';
import { serviceToPlatform, platformToService } from '@/lib/buffer/map';

describe('buffer service <-> platform mapping', () => {
  it('maps buffer twitter to platform x and back', () => {
    expect(serviceToPlatform('twitter')).toBe('x');
    expect(platformToService('x')).toBe('twitter');
  });

  it('passes through facebook and linkedin unchanged', () => {
    expect(serviceToPlatform('facebook')).toBe('facebook');
    expect(serviceToPlatform('linkedin')).toBe('linkedin');
    expect(platformToService('facebook')).toBe('facebook');
    expect(platformToService('linkedin')).toBe('linkedin');
  });

  it('returns null for unknown/unsupported services', () => {
    expect(serviceToPlatform('mastodon')).toBeNull();
    expect(serviceToPlatform('tiktok')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/buffer/map.test.ts`
Expected: FAIL — cannot find module `@/lib/buffer/map`.

- [ ] **Step 3: Write the types**

```typescript
// src/lib/buffer/types.ts
import type { Platform } from '@/lib/platforms';

export type ShareMode = 'addToQueue' | 'shareNow' | 'shareNext' | 'customScheduled';
export type SchedulingType = 'automatic' | 'notification';

export interface BufferChannel {
  id: string;
  service: string;          // raw Buffer service (e.g. "twitter")
  name: string;
  platform: Platform | null; // mapped CommandPost platform, null if unsupported
}

export interface BufferPost {
  id: string;
  status: string;            // e.g. "draft" | "scheduled" | "sent" | "buffer"
  text: string;
  dueAt: string | null;      // ISO
  sentAt: string | null;     // ISO
  channelId: string;
  channelService: string;
  platform: Platform | null;
  shareMode: ShareMode | null;
  externalLink: string | null;
  allowedActions: string[];  // gates edit/delete buttons
}

export interface CreatePostArgs {
  channelIds: string[];      // fans out to one createPost per channel
  text: string;
  mode: ShareMode;
  dueAt?: string;            // required when mode === 'customScheduled'
}

export interface EditPostArgs {
  id: string;
  mode: ShareMode;
  text?: string;
  dueAt?: string;
}
```

- [ ] **Step 4: Write the mapping**

```typescript
// src/lib/buffer/map.ts
import type { Platform } from '@/lib/platforms';
import { isPlatform } from '@/lib/platforms';

// Buffer calls X "twitter"; CommandPost calls it "x". Everything else is 1:1.
export function serviceToPlatform(service: string): Platform | null {
  if (service === 'twitter') return 'x';
  return isPlatform(service) ? service : null;
}

export function platformToService(platform: Platform): string {
  if (platform === 'x') return 'twitter';
  return platform;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/buffer/map.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/buffer/types.ts src/lib/buffer/map.ts tests/buffer/map.test.ts
git commit -m "feat(buffer): types + service<->platform mapping"
```

---

### Task 2: GraphQL client (`bufferGql`) + config check

**Files:**
- Create: `src/lib/buffer/client.ts`
- Test: `tests/buffer/client.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/buffer/client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('bufferGql client', () => {
  beforeEach(() => {
    vi.stubEnv('BUFFER_API_KEY', 'test-key');
    vi.stubEnv('BUFFER_ORG_ID', 'org-123');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('isBufferConfigured is true when both env vars set', async () => {
    const { isBufferConfigured } = await import('@/lib/buffer/client');
    expect(isBufferConfigured()).toBe(true);
  });

  it('posts query with bearer auth and returns data', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { ping: 'pong' } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { bufferGql } = await import('@/lib/buffer/client');
    const data = await bufferGql<{ ping: string }>('{ ping }');
    expect(data.ping).toBe('pong');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.buffer.com');
    expect(init.headers.Authorization).toBe('Bearer test-key');
  });

  it('throws BufferError when GraphQL returns errors[]', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ errors: [{ message: 'bad query' }] }),
    }));
    const { bufferGql, BufferError } = await import('@/lib/buffer/client');
    await expect(bufferGql('{ bad }')).rejects.toBeInstanceOf(BufferError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/buffer/client.test.ts`
Expected: FAIL — cannot find module `@/lib/buffer/client`.

- [ ] **Step 3: Write the client**

```typescript
// src/lib/buffer/client.ts
const BUFFER_ENDPOINT = 'https://api.buffer.com';

export class BufferError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = 'BufferError';
  }
}

export function isBufferConfigured(): boolean {
  return Boolean(process.env.BUFFER_API_KEY && process.env.BUFFER_ORG_ID);
}

export function bufferOrgId(): string {
  const id = process.env.BUFFER_ORG_ID;
  if (!id) throw new BufferError('BUFFER_ORG_ID is not set');
  return id;
}

export async function bufferGql<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const key = process.env.BUFFER_API_KEY;
  if (!key) throw new BufferError('BUFFER_API_KEY is not set');

  const res = await fetch(BUFFER_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    if (res.status === 401) throw new BufferError('Buffer key invalid/expired — check Settings', '401');
    throw new BufferError(`Buffer HTTP ${res.status}`, String(res.status));
  }

  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors?.length) {
    throw new BufferError(json.errors.map((e) => e.message).join('; '));
  }
  if (!json.data) throw new BufferError('Buffer returned no data');
  return json.data;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/buffer/client.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/buffer/client.ts tests/buffer/client.test.ts
git commit -m "feat(buffer): GraphQL client with bearer auth + typed errors"
```

---

### Task 3: Query wrappers (channels, posts, create, edit, delete)

**Files:**
- Create: `src/lib/buffer/queries.ts`
- Test: `tests/buffer/queries.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/buffer/queries.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/buffer/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/buffer/client')>('@/lib/buffer/client');
  return { ...actual, bufferGql: vi.fn(), bufferOrgId: () => 'org-123' };
});

import { bufferGql, BufferError } from '@/lib/buffer/client';
import { listChannels, listPosts, createPost, deletePost } from '@/lib/buffer/queries';

const mockGql = vi.mocked(bufferGql);

describe('buffer queries', () => {
  beforeEach(() => mockGql.mockReset());
  afterEach(() => vi.restoreAllMocks());

  it('listChannels maps service to platform', async () => {
    mockGql.mockResolvedValue({ channels: [{ id: 'c1', service: 'twitter', name: 'X acct' }] });
    const channels = await listChannels();
    expect(channels[0]).toMatchObject({ id: 'c1', service: 'twitter', platform: 'x' });
  });

  it('listPosts flattens edges and maps platform', async () => {
    mockGql.mockResolvedValue({
      posts: { edges: [{ node: {
        id: 'p1', status: 'scheduled', text: 'hi', dueAt: '2026-12-01T17:00:00.000Z',
        sentAt: null, channelId: 'c1', channelService: 'facebook', shareMode: 'customScheduled',
        externalLink: null, allowedActions: ['edit', 'delete'],
      } }] },
    });
    const posts = await listPosts({});
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({ id: 'p1', platform: 'facebook' });
  });

  it('createPost returns post on PostActionSuccess', async () => {
    mockGql.mockResolvedValue({ createPost: { __typename: 'PostActionSuccess', post: {
      id: 'p2', status: 'scheduled', text: 'hi', dueAt: '2026-12-01T17:00:00.000Z',
      sentAt: null, channelId: 'c1', channelService: 'twitter', shareMode: 'customScheduled',
      externalLink: null, allowedActions: [],
    } } });
    const post = await createPost({ channelId: 'c1', text: 'hi', mode: 'customScheduled', dueAt: '2026-12-01T17:00:00.000Z' });
    expect(post.id).toBe('p2');
    expect(post.platform).toBe('x');
  });

  it('createPost throws BufferError on a union error member', async () => {
    mockGql.mockResolvedValue({ createPost: { __typename: 'InvalidInputError', message: 'text too long' } });
    await expect(
      createPost({ channelId: 'c1', text: 'x', mode: 'addToQueue' }),
    ).rejects.toThrow('text too long');
  });

  it('deletePost resolves on DeletePostSuccess', async () => {
    mockGql.mockResolvedValue({ deletePost: { __typename: 'DeletePostSuccess', id: 'p1' } });
    await expect(deletePost('p1')).resolves.toBe('p1');
  });

  it('deletePost throws on VoidMutationError', async () => {
    mockGql.mockResolvedValue({ deletePost: { __typename: 'VoidMutationError', message: 'nope' } });
    await expect(deletePost('p1')).rejects.toBeInstanceOf(BufferError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/buffer/queries.test.ts`
Expected: FAIL — cannot find module `@/lib/buffer/queries`.

- [ ] **Step 3: Write the query wrappers**

```typescript
// src/lib/buffer/queries.ts
import { bufferGql, bufferOrgId, BufferError } from './client';
import { serviceToPlatform } from './map';
import type { BufferChannel, BufferPost, ShareMode } from './types';

const POST_FIELDS = `
  id status text dueAt sentAt channelId channelService shareMode externalLink allowedActions
`;

const POST_ACTION_RESULT = `
  __typename
  ... on PostActionSuccess { post { ${POST_FIELDS} } }
  ... on RestProxyError { message code }
  ... on InvalidInputError { message }
  ... on LimitReachedError { message }
  ... on UnauthorizedError { message }
  ... on NotFoundError { message }
  ... on UnexpectedError { message }
`;

interface RawChannel { id: string; service: string; name: string; }
interface RawPost {
  id: string; status: string; text: string | null; dueAt: string | null; sentAt: string | null;
  channelId: string; channelService: string; shareMode: ShareMode | null;
  externalLink: string | null; allowedActions: string[] | null;
}

function toChannel(c: RawChannel): BufferChannel {
  return { id: c.id, service: c.service, name: c.name, platform: serviceToPlatform(c.service) };
}

function toPost(p: RawPost): BufferPost {
  return {
    id: p.id,
    status: p.status,
    text: p.text ?? '',
    dueAt: p.dueAt,
    sentAt: p.sentAt,
    channelId: p.channelId,
    channelService: p.channelService,
    platform: serviceToPlatform(p.channelService),
    shareMode: p.shareMode,
    externalLink: p.externalLink,
    allowedActions: p.allowedActions ?? [],
  };
}

// Branch on the PostActionPayload union; return the post or throw the typed error.
function unwrapPostAction(result: { __typename: string; post?: RawPost; message?: string }): BufferPost {
  if (result.__typename === 'PostActionSuccess' && result.post) return toPost(result.post);
  throw new BufferError(result.message ?? `Buffer error (${result.__typename})`);
}

export async function listChannels(): Promise<BufferChannel[]> {
  const data = await bufferGql<{ channels: RawChannel[] }>(
    `query($o:OrganizationId!){ channels(input:{organizationId:$o}){ id service name } }`,
    { o: bufferOrgId() },
  );
  return data.channels.map(toChannel);
}

export async function listPosts(opts: { channelIds?: string[]; status?: string[]; first?: number }): Promise<BufferPost[]> {
  const filter: Record<string, unknown> = {};
  if (opts.channelIds?.length) filter.channelIds = opts.channelIds;
  if (opts.status?.length) filter.status = opts.status;
  const data = await bufferGql<{ posts: { edges: Array<{ node: RawPost }> } }>(
    `query($i:PostsInput!,$first:Int){ posts(input:$i, first:$first){ edges { node { ${POST_FIELDS} } } } }`,
    { i: { organizationId: bufferOrgId(), filter }, first: opts.first ?? 100 },
  );
  return data.posts.edges.map((e) => toPost(e.node));
}

export async function createPost(args: { channelId: string; text: string; mode: ShareMode; dueAt?: string }): Promise<BufferPost> {
  const data = await bufferGql<{ createPost: { __typename: string; post?: RawPost; message?: string } }>(
    `mutation($i:CreatePostInput!){ createPost(input:$i){ ${POST_ACTION_RESULT} } }`,
    { i: {
      channelId: args.channelId,
      text: args.text,
      schedulingType: 'automatic',
      mode: args.mode,
      ...(args.dueAt ? { dueAt: args.dueAt } : {}),
      assets: [],
      source: 'commandpost',
    } },
  );
  return unwrapPostAction(data.createPost);
}

export async function editPost(args: { id: string; mode: ShareMode; text?: string; dueAt?: string }): Promise<BufferPost> {
  const data = await bufferGql<{ editPost: { __typename: string; post?: RawPost; message?: string } }>(
    `mutation($i:EditPostInput!){ editPost(input:$i){ ${POST_ACTION_RESULT} } }`,
    { i: {
      id: args.id,
      schedulingType: 'automatic',
      mode: args.mode,
      ...(args.text !== undefined ? { text: args.text } : {}),
      ...(args.dueAt ? { dueAt: args.dueAt } : {}),
      assets: [],
    } },
  );
  return unwrapPostAction(data.editPost);
}

export async function deletePost(id: string): Promise<string> {
  const data = await bufferGql<{ deletePost: { __typename: string; id?: string; message?: string } }>(
    `mutation($i:DeletePostInput!){ deletePost(input:$i){ __typename ... on DeletePostSuccess { id } ... on VoidMutationError { message } } }`,
    { i: { id } },
  );
  if (data.deletePost.__typename === 'DeletePostSuccess' && data.deletePost.id) return data.deletePost.id;
  throw new BufferError(data.deletePost.message ?? 'Buffer delete failed');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/buffer/queries.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/buffer/queries.ts tests/buffer/queries.test.ts
git commit -m "feat(buffer): channel + post query/mutation wrappers"
```

---

### Task 4: `GET /api/social/status` route

**Files:**
- Create: `src/app/api/social/status/route.ts`
- Test: `tests/api/social-status.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/social-status.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/buffer/client', () => ({ isBufferConfigured: vi.fn(), bufferOrgId: () => 'org-123' }));
vi.mock('@/lib/buffer/queries', () => ({ listChannels: vi.fn() }));

import { isBufferConfigured } from '@/lib/buffer/client';
import { listChannels } from '@/lib/buffer/queries';
import { GET } from '@/app/api/social/status/route';

describe('GET /api/social/status', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns configured:false with no channels when key missing', async () => {
    vi.mocked(isBufferConfigured).mockReturnValue(false);
    const res = await GET();
    const body = await res.json();
    expect(body).toEqual({ configured: false, orgId: null, channels: [] });
    expect(listChannels).not.toHaveBeenCalled();
  });

  it('returns channels when configured', async () => {
    vi.mocked(isBufferConfigured).mockReturnValue(true);
    vi.mocked(listChannels).mockResolvedValue([
      { id: 'c1', service: 'twitter', name: 'X', platform: 'x' },
    ]);
    const res = await GET();
    const body = await res.json();
    expect(body.configured).toBe(true);
    expect(body.channels).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/social-status.test.ts`
Expected: FAIL — cannot find module `@/app/api/social/status/route`.

- [ ] **Step 3: Write the route**

```typescript
// src/app/api/social/status/route.ts
import { NextResponse } from 'next/server';
import { isBufferConfigured, bufferOrgId, BufferError } from '@/lib/buffer/client';
import { listChannels } from '@/lib/buffer/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isBufferConfigured()) {
    return NextResponse.json({ configured: false, orgId: null, channels: [] });
  }
  try {
    const channels = await listChannels();
    return NextResponse.json({ configured: true, orgId: bufferOrgId(), channels });
  } catch (err) {
    const message = err instanceof BufferError ? err.message : 'Failed to reach Buffer';
    return NextResponse.json({ configured: true, orgId: bufferOrgId(), channels: [], error: message }, { status: 502 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/social-status.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/social/status/route.ts tests/api/social-status.test.ts
git commit -m "feat(buffer): /api/social/status route"
```

---

### Task 5: `GET` + `POST /api/social/posts` route

**Files:**
- Create: `src/app/api/social/posts/route.ts`
- Test: `tests/api/social-posts.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/social-posts.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/buffer/queries', () => ({ listPosts: vi.fn(), createPost: vi.fn() }));
import { listPosts, createPost } from '@/lib/buffer/queries';
import { GET, POST } from '@/app/api/social/posts/route';

function req(url: string, init?: RequestInit) {
  return new NextRequest(new Request(url, init));
}

describe('/api/social/posts', () => {
  beforeEach(() => vi.resetAllMocks());

  it('GET returns the queue', async () => {
    vi.mocked(listPosts).mockResolvedValue([{ id: 'p1' } as never]);
    const res = await GET(req('http://localhost/api/social/posts'));
    expect(await res.json()).toEqual({ posts: [{ id: 'p1' }] });
  });

  it('GET passes status + channelId filters', async () => {
    vi.mocked(listPosts).mockResolvedValue([]);
    await GET(req('http://localhost/api/social/posts?status=scheduled&channelId=c1'));
    expect(listPosts).toHaveBeenCalledWith({ status: ['scheduled'], channelIds: ['c1'] });
  });

  it('POST 400s when channelIds empty', async () => {
    const res = await POST(req('http://localhost/api/social/posts', {
      method: 'POST', body: JSON.stringify({ channelIds: [], text: 'hi', mode: 'addToQueue' }),
    }));
    expect(res.status).toBe(400);
    expect(createPost).not.toHaveBeenCalled();
  });

  it('POST fans out one createPost per channel', async () => {
    vi.mocked(createPost).mockResolvedValue({ id: 'p1' } as never);
    const res = await POST(req('http://localhost/api/social/posts', {
      method: 'POST', body: JSON.stringify({ channelIds: ['c1', 'c2'], text: 'hi', mode: 'addToQueue' }),
    }));
    const body = await res.json();
    expect(createPost).toHaveBeenCalledTimes(2);
    expect(body.created).toHaveLength(2);
  });

  it('POST 400s when customScheduled without dueAt', async () => {
    const res = await POST(req('http://localhost/api/social/posts', {
      method: 'POST', body: JSON.stringify({ channelIds: ['c1'], text: 'hi', mode: 'customScheduled' }),
    }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/social-posts.test.ts`
Expected: FAIL — cannot find module `@/app/api/social/posts/route`.

- [ ] **Step 3: Write the route**

```typescript
// src/app/api/social/posts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { listPosts, createPost } from '@/lib/buffer/queries';
import { BufferError } from '@/lib/buffer/client';
import type { ShareMode } from '@/lib/buffer/types';

export const dynamic = 'force-dynamic';

const SHARE_MODES: ShareMode[] = ['addToQueue', 'shareNow', 'shareNext', 'customScheduled'];

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const status = params.get('status');
  const channelId = params.get('channelId');
  try {
    const posts = await listPosts({
      ...(status ? { status: [status] } : {}),
      ...(channelId ? { channelIds: [channelId] } : {}),
    });
    return NextResponse.json({ posts });
  } catch (err) {
    const message = err instanceof BufferError ? err.message : 'Failed to reach Buffer';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const channelIds: string[] = Array.isArray(body?.channelIds) ? body.channelIds.filter((c: unknown) => typeof c === 'string') : [];
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  const mode = body?.mode as ShareMode;
  const dueAt = typeof body?.dueAt === 'string' ? body.dueAt : undefined;

  if (!channelIds.length) return NextResponse.json({ error: 'Pick at least one channel' }, { status: 400 });
  if (!text) return NextResponse.json({ error: 'Text is empty' }, { status: 400 });
  if (!SHARE_MODES.includes(mode)) return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  if (mode === 'customScheduled' && !dueAt) return NextResponse.json({ error: 'A scheduled time is required' }, { status: 400 });

  try {
    const created = await Promise.all(
      channelIds.map((channelId) => createPost({ channelId, text, mode, dueAt })),
    );
    return NextResponse.json({ created });
  } catch (err) {
    const message = err instanceof BufferError ? err.message : 'Failed to reach Buffer';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/social-posts.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/social/posts/route.ts tests/api/social-posts.test.ts
git commit -m "feat(buffer): /api/social/posts GET (queue) + POST (create, fan-out)"
```

---

### Task 6: `PATCH` + `DELETE /api/social/posts/[id]` route

**Files:**
- Create: `src/app/api/social/posts/[id]/route.ts`
- Test: `tests/api/social-post-id.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/social-post-id.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/buffer/queries', () => ({ editPost: vi.fn(), deletePost: vi.fn() }));
import { editPost, deletePost } from '@/lib/buffer/queries';
import { PATCH, DELETE } from '@/app/api/social/posts/[id]/route';

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
function req(method: string, body?: unknown) {
  return new NextRequest(new Request('http://localhost/api/social/posts/p1', {
    method, ...(body ? { body: JSON.stringify(body) } : {}),
  }));
}

describe('/api/social/posts/[id]', () => {
  beforeEach(() => vi.resetAllMocks());

  it('PATCH reschedules via editPost', async () => {
    vi.mocked(editPost).mockResolvedValue({ id: 'p1' } as never);
    const res = await PATCH(req('PATCH', { mode: 'customScheduled', dueAt: '2026-12-01T17:00:00.000Z' }), ctx('p1'));
    expect(res.status).toBe(200);
    expect(editPost).toHaveBeenCalledWith({ id: 'p1', mode: 'customScheduled', dueAt: '2026-12-01T17:00:00.000Z', text: undefined });
  });

  it('PATCH 400s on invalid mode', async () => {
    const res = await PATCH(req('PATCH', { mode: 'nope' }), ctx('p1'));
    expect(res.status).toBe(400);
  });

  it('DELETE removes the post', async () => {
    vi.mocked(deletePost).mockResolvedValue('p1');
    const res = await DELETE(req('DELETE'), ctx('p1'));
    expect(res.status).toBe(200);
    expect(deletePost).toHaveBeenCalledWith('p1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/social-post-id.test.ts`
Expected: FAIL — cannot find module `@/app/api/social/posts/[id]/route`.

- [ ] **Step 3: Write the route**

```typescript
// src/app/api/social/posts/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { editPost, deletePost } from '@/lib/buffer/queries';
import { BufferError } from '@/lib/buffer/client';
import type { ShareMode } from '@/lib/buffer/types';

export const dynamic = 'force-dynamic';

const SHARE_MODES: ShareMode[] = ['addToQueue', 'shareNow', 'shareNext', 'customScheduled'];

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const mode = body?.mode as ShareMode;
  const text = typeof body?.text === 'string' ? body.text : undefined;
  const dueAt = typeof body?.dueAt === 'string' ? body.dueAt : undefined;

  if (!SHARE_MODES.includes(mode)) return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  if (mode === 'customScheduled' && !dueAt) return NextResponse.json({ error: 'A scheduled time is required' }, { status: 400 });

  try {
    const post = await editPost({ id, mode, text, dueAt });
    return NextResponse.json({ post });
  } catch (err) {
    const message = err instanceof BufferError ? err.message : 'Failed to reach Buffer';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  try {
    const deletedId = await deletePost(id);
    return NextResponse.json({ id: deletedId });
  } catch (err) {
    const message = err instanceof BufferError ? err.message : 'Failed to reach Buffer';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/social-post-id.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/social/posts/[id]/route.ts" tests/api/social-post-id.test.ts
git commit -m "feat(buffer): /api/social/posts/[id] PATCH (edit/reschedule) + DELETE"
```

---

### Task 7: Live smoke script (gated, manual)

**Files:**
- Create: `scripts/buffer-smoke.ts`

This is a manual end-to-end check against the real API (creates a draft + deletes it). Not run in CI.

- [ ] **Step 1: Write the script**

```typescript
// scripts/buffer-smoke.ts
// Usage: npx tsx scripts/buffer-smoke.ts   (requires BUFFER_API_KEY + BUFFER_ORG_ID in env)
import { listChannels, createPost, deletePost } from '../src/lib/buffer/queries';

async function main() {
  const channels = await listChannels();
  console.log('Channels:', channels.map((c) => `${c.platform ?? c.service}:${c.name}`).join(', '));
  if (!channels.length) throw new Error('No channels — check key/org');

  const draft = await createPost({
    channelId: channels[0].id,
    text: 'CommandPost smoke test — please ignore',
    mode: 'customScheduled',
    dueAt: '2026-12-01T17:00:00.000Z',
  });
  console.log('Created draft/post id:', draft.id, 'status:', draft.status);

  const deleted = await deletePost(draft.id);
  console.log('Deleted id:', deleted);
  console.log('SMOKE OK');
}

main().catch((err) => { console.error('SMOKE FAILED:', err); process.exit(1); });
```

- [ ] **Step 2: Run it (loads .env)**

Run: `cd /Users/philipsmith/commandpost && set -a && . ./.env && set +a && npx tsx scripts/buffer-smoke.ts`
Expected: prints channels, "Created ... id", "Deleted id", "SMOKE OK". (Note: a `customScheduled` post may post at the due date — the due date is far future and you can delete it; the script deletes it immediately anyway.)

- [ ] **Step 3: Commit**

```bash
git add scripts/buffer-smoke.ts
git commit -m "chore(buffer): gated live smoke script"
```

---

### Task 8: Settings — "Social / Buffer" connection panel

**Files:**
- Create: `src/app/(dashboard)/settings/social/page.tsx`
- Modify: `src/app/(dashboard)/settings/page.tsx` (add a link button next to System & Backup / Webhooks)

This is a server component that shows connection status + channels. No new automated test (server component hitting a live API); verified manually.

- [ ] **Step 1: Add the Social settings page**

```tsx
// src/app/(dashboard)/settings/social/page.tsx
import Link from 'next/link';
import { isBufferConfigured } from '@/lib/buffer/client';
import { listChannels } from '@/lib/buffer/queries';
import type { BufferChannel } from '@/lib/buffer/types';

export const dynamic = 'force-dynamic';

export default async function SocialSettingsPage() {
  const configured = isBufferConfigured();
  let channels: BufferChannel[] = [];
  let error: string | null = null;
  if (configured) {
    try {
      channels = await listChannels();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to reach Buffer';
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl">
      <Link href="/settings" className="text-sm text-gray-400 hover:text-gray-200">← Settings</Link>
      <h2 className="text-2xl font-bold my-4">Social / Buffer</h2>

      <div className="mb-6">
        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${configured && !error ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
          <span className="w-2 h-2 rounded-full bg-current" />
          {configured ? (error ? 'Connected, but API error' : 'Connected') : 'Not configured'}
        </span>
        {!configured && (
          <p className="text-sm text-gray-400 mt-2">Set <code>BUFFER_API_KEY</code> and <code>BUFFER_ORG_ID</code> in the server <code>.env</code>.</p>
        )}
        {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
      </div>

      {channels.length > 0 && (
        <div>
          <h3 className="text-sm text-gray-400 mb-2">Connected channels</h3>
          <ul className="space-y-2">
            {channels.map((c) => (
              <li key={c.id} className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-sm">
                <span>{c.name}</span>
                <span className="text-gray-500">{c.platform ?? c.service}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Link it from the main Settings page**

In `src/app/(dashboard)/settings/page.tsx`, add to the button row (after the Webhooks link):

```tsx
        <Link href="/settings/social" className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">Social / Buffer</Link>
```

- [ ] **Step 3: Manual verify**

Run: `npm run dev`, open `http://localhost:3004/settings/social`.
Expected: "Connected" badge + a list showing ReKindle Leads (facebook), philip-smith (linkedin), PhilSmith (x).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/settings/social/page.tsx" "src/app/(dashboard)/settings/page.tsx"
git commit -m "feat(buffer): Settings → Social/Buffer connection panel"
```

---

### Task 9: `/social` cockpit page — queue list + compose + delete

**Files:**
- Create: `src/app/(dashboard)/social/page.tsx` (client component)
- Modify: `src/components/sidebar.tsx` (add nav item)

Client component that loads the queue from `/api/social/posts`, shows a compose form, and supports delete + reschedule. Verified manually (UI).

- [ ] **Step 1: Add the sidebar nav item**

In `src/components/sidebar.tsx`, add after the `/content` (Radio/Video) line:

```tsx
  { href: '/social', label: 'Social', icon: '◮' },
```

- [ ] **Step 2: Add the cockpit page**

```tsx
// src/app/(dashboard)/social/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import type { BufferChannel, BufferPost, ShareMode } from '@/lib/buffer/types';

export default function SocialPage() {
  const [channels, setChannels] = useState<BufferChannel[]>([]);
  const [posts, setPosts] = useState<BufferPost[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // compose state
  const [text, setText] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<ShareMode>('addToQueue');
  const [dueAt, setDueAt] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadQueue = useCallback(async () => {
    const res = await fetch('/api/social/posts');
    const body = await res.json();
    if (!res.ok) { setError(body.error ?? 'Failed to load queue'); return; }
    setError(null);
    setPosts(body.posts);
  }, []);

  useEffect(() => {
    (async () => {
      const statusRes = await fetch('/api/social/status');
      const status = await statusRes.json();
      setConfigured(status.configured);
      setChannels(status.channels ?? []);
      if (status.configured) await loadQueue();
      setLoading(false);
    })();
  }, [loadQueue]);

  function toggleChannel(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    const res = await fetch('/api/social/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelIds: selected, text, mode, dueAt: mode === 'customScheduled' ? new Date(dueAt).toISOString() : undefined }),
    });
    const body = await res.json();
    setSubmitting(false);
    if (!res.ok) { setError(body.error ?? 'Failed to create post'); return; }
    setText(''); setSelected([]); setDueAt('');
    await loadQueue();
  }

  async function remove(id: string) {
    if (!confirm('Delete this post from Buffer?')) return;
    const res = await fetch(`/api/social/posts/${id}`, { method: 'DELETE' });
    if (!res.ok) { const b = await res.json(); setError(b.error ?? 'Delete failed'); return; }
    await loadQueue();
  }

  if (loading) return <div className="p-6 text-gray-400">Loading…</div>;
  if (!configured) return (
    <div className="p-6 text-gray-300">
      Buffer is not configured. See <a href="/settings/social" className="text-blue-400 underline">Settings → Social</a>.
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-3xl">
      <h2 className="text-2xl font-bold mb-6">Social</h2>
      {error && <div className="mb-4 px-4 py-2 bg-red-900 text-red-200 rounded-lg text-sm">{error}</div>}

      {/* Compose */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-8">
        <h3 className="text-sm font-medium text-gray-300 mb-3">New post</h3>
        <textarea
          value={text} onChange={(e) => setText(e.target.value)}
          placeholder="What do you want to post?"
          className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm h-24 outline-none focus:border-blue-500"
        />
        <div className="flex flex-wrap gap-2 my-3">
          {channels.map((c) => (
            <button key={c.id} onClick={() => toggleChannel(c.id)}
              className={`px-3 py-1 rounded-full text-sm border ${selected.includes(c.id) ? 'bg-blue-600 border-blue-500' : 'bg-gray-800 border-gray-700'}`}>
              {c.name} <span className="text-gray-400">({c.platform ?? c.service})</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 mb-3">
          <select value={mode} onChange={(e) => setMode(e.target.value as ShareMode)}
            className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm">
            <option value="addToQueue">Add to queue</option>
            <option value="customScheduled">Schedule for…</option>
            <option value="shareNow">Share now</option>
          </select>
          {mode === 'customScheduled' && (
            <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)}
              className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm" />
          )}
        </div>
        <button onClick={submit} disabled={submitting || !text || !selected.length}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-medium">
          {submitting ? 'Posting…' : 'Add to Buffer'}
        </button>
      </div>

      {/* Queue */}
      <h3 className="text-sm font-medium text-gray-300 mb-3">Queue</h3>
      <ul className="space-y-3">
        {posts.map((p) => (
          <li key={p.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">
                {p.platform ?? p.channelService} · {p.status}
                {p.dueAt ? ` · ${new Date(p.dueAt).toLocaleString()}` : ''}
              </span>
              {p.allowedActions.includes('delete') && (
                <button onClick={() => remove(p.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
              )}
            </div>
            <p className="text-sm whitespace-pre-wrap">{p.text}</p>
          </li>
        ))}
        {posts.length === 0 && <li className="text-sm text-gray-500">Queue is empty.</li>}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Manual verify**

Run: `npm run dev`, open `http://localhost:3004/social`.
Expected: queue loads (the old 2017 sent posts will show as `sent`), the compose box can add a post to queue on a selected channel, and Delete removes a deletable post. Verify a created post appears in Buffer's own dashboard.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/social/page.tsx" src/components/sidebar.tsx
git commit -m "feat(buffer): /social cockpit — queue list, compose, delete"
```

---

### Task 10: Full test + lint pass, then push

- [ ] **Step 1: Run the whole suite**

Run: `npm test`
Expected: all tests pass (including the new `tests/buffer/*` and `tests/api/social-*`).

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors (repo is at zero ESLint debt — keep it there).

- [ ] **Step 3: Production build sanity (optional, local)**

Run: `npm run build`
Expected: build succeeds. (Do NOT run concurrently with a server deploy build.)

- [ ] **Step 4: Push the branch**

```bash
git push -u origin feat/buffer-queue-integration
```

---

## Deploy (after merge — separate step, with Phil)

1. Add `BUFFER_API_KEY` and `BUFFER_ORG_ID` to the server `.env` at `/var/www/commandpost/.env`.
2. Deploy via `./scripts/deploy.sh` (git pull + npm install + build + `pm2 restart`). No new npm deps were added, but deploy.sh installs anyway.
3. Watch for the known server gotcha: a locally-modified `package-lock.json` can make `git pull` abort — `git checkout -- package-lock.json` then pull.
4. **Rotate the Buffer API key** (it was pasted in plaintext during design).

## Self-review notes

- **Spec coverage:** live-proxy architecture (Tasks 2–6), text-only create with empty `assets` (Task 3/5), specific-time + add-to-queue scheduling (Task 5/9), edit/reschedule + delete (Tasks 3/6), Settings status panel (Task 8), `/social` cockpit (Task 9), security/key-rotation (deploy notes), error handling via typed `BufferError` + union unwrap (Tasks 2/3), tests (Tasks 1–6). Calendar (Phase 3) and Generate button (Phase 4) intentionally deferred to follow-up plans. `BufferPublisher` adapter intentionally dropped (no consumer; noted at top).
- **Type consistency:** `BufferPost`, `BufferChannel`, `ShareMode`, `CreatePostArgs`/`EditPostArgs` defined in Task 1 and used identically in Tasks 3/5/6/9. Query function names (`listChannels`, `listPosts`, `createPost`, `editPost`, `deletePost`) consistent across queries, routes, and the smoke script.
- **No placeholders:** every step contains runnable code/commands.
