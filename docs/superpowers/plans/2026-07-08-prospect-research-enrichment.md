# Prospect Research Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Research each prospect (web search via the Claude API) before drafting letters/emails so drafts weave in true, business-specific facts.

**Architecture:** A new `research.ts` module calls the Messages API with the server-side `web_search_20260209` tool, stores bullet facts on `leads.research_notes`, and `generateDraft` injects them into the prompt. Research runs automatically in the letter-batch tick and the draft API action (fail-open), plus a manual Re-research button.

**Tech Stack:** Next.js 16 (App Router), better-sqlite3, raw-fetch Anthropic Messages API (no SDK in this repo), vitest.

**Spec:** `docs/superpowers/specs/2026-07-08-prospect-research-enrichment-design.md`

## Global Constraints

- Model for research calls: `claude-sonnet-4-6` (same as drafting).
- Web search capped at `max_uses: 5` per lead.
- Sentinel for "looked, nothing usable": the exact string `NOTHING FOUND`.
- Freshness window: 30 days (`RESEARCH_FRESH_DAYS = 30`).
- Research failures must NEVER block or fail a draft or the letter batch (fail-open).
- Business-only facts; never personal-life details; drop facts not confirmed to be about this business in this city.
- Drafts weave in at most two facts and never include source URLs.
- Tests run with `npm test` (vitest, `tests/` directory). Tests must not require `ANTHROPIC_API_KEY`.
- Build on branch `feat/prospect-research` in a worktree off `origin/main` (repo convention: `git worktree add ~/cp-research -b feat/prospect-research origin/main`). Push via `git push origin feat/prospect-research:main` (rebase first if origin/main advanced), then deploy with `./scripts/deploy.sh` from the main checkout.
- The repo calls the Anthropic API with raw `fetch` (see `src/lib/claude.ts`) — do NOT add the `@anthropic-ai/sdk` dependency.

---

### Task 1: Migration — `research_notes` / `researched_at` columns on `leads`

**Files:**
- Modify: `src/lib/db.ts` (immediately after the letter-batch column block that adds `letter_status`/`letter_sent_at_q`/`letter_batch_date`, just before `return db;` in `initDb`)
- Test: `tests/research-migration.test.ts`

**Interfaces:**
- Produces: columns `leads.research_notes TEXT` and `leads.researched_at TEXT`, present after `initDb()`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/research-migration.test.ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { initDb } from '@/lib/db';

describe('research migration', () => {
  it('adds research_notes and researched_at to leads', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'cp-research-mig-'));
    const db = initDb(path.join(dir, 'test.db'));
    const cols = new Set(
      (db.prepare('PRAGMA table_info(leads)').all() as { name: string }[]).map((c) => c.name)
    );
    expect(cols.has('research_notes')).toBe(true);
    expect(cols.has('researched_at')).toBe(true);
    db.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/research-migration.test.ts`
Expected: FAIL — `expect(cols.has('research_notes')).toBe(true)` is false.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/db.ts`, after the letter-batch column block (the one adding `letter_status`, `letter_sent_at_q`, `letter_batch_date`) and before `return db;`:

```ts
  // Prospect research enrichment: web-searched facts used to personalize drafts.
  {
    const have = new Set(
      (db.prepare("PRAGMA table_info(leads)").all() as { name: string }[]).map((c) => c.name)
    );
    for (const name of ['research_notes', 'researched_at']) {
      if (!have.has(name)) db.exec(`ALTER TABLE leads ADD COLUMN ${name} TEXT`);
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/research-migration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts tests/research-migration.test.ts
git commit -m "feat(research): add research_notes/researched_at columns to leads"
```

---

### Task 2: `askClaudeWithWebSearch` helper in `src/lib/claude.ts`

**Files:**
- Modify: `src/lib/claude.ts`
- Test: `tests/claude-web-search.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `askClaudeWithWebSearch(systemPrompt: string, userMessage: string, maxTokens?: number, model?: string, maxSearches?: number): Promise<string | null>` — returns the LAST text block of the response (the model's final summary after searching), or null on any error.

- [ ] **Step 1: Write the failing test**

```ts
// tests/claude-web-search.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { askClaudeWithWebSearch } from '@/lib/claude';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('askClaudeWithWebSearch', () => {
  it('sends the web_search tool and returns the last text block', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    let sentBody: Record<string, unknown> | null = null;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      sentBody = JSON.parse(init.body as string);
      return {
        ok: true,
        json: async () => ({
          content: [
            { type: 'text', text: "I'll search for this business." },
            { type: 'server_tool_use', id: 'x', name: 'web_search', input: {} },
            { type: 'web_search_tool_result', tool_use_id: 'x', content: [] },
            { type: 'text', text: '- Fact one (https://example.com)' },
          ],
        }),
      };
    }));

    const out = await askClaudeWithWebSearch('sys', 'user msg', 1024);
    expect(out).toBe('- Fact one (https://example.com)');
    const tools = (sentBody as unknown as { tools: Array<{ type: string; max_uses: number }> }).tools;
    expect(tools[0].type).toBe('web_search_20260209');
    expect(tools[0].max_uses).toBe(5);
  });

  it('returns null on API error', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, text: async () => 'boom' })));
    expect(await askClaudeWithWebSearch('sys', 'user')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/claude-web-search.test.ts`
Expected: FAIL — `askClaudeWithWebSearch` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/claude.ts`:

```ts
// Like askClaude, but with the server-side web search tool enabled. The
// response interleaves text + search-result blocks; the LAST text block is
// the model's final answer after searching, so that's what we return.
export async function askClaudeWithWebSearch(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 1024,
  model: string = 'claude-sonnet-4-6',
  maxSearches: number = 5
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: maxSearches }],
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Claude web-search API error (${response.status}): ${text}`);
      return null;
    }

    const data = await response.json();
    const blocks: Array<{ type: string; text?: string }> = data.content ?? [];
    const textBlocks = blocks.filter((b) => b.type === 'text' && typeof b.text === 'string');
    return textBlocks.length ? textBlocks[textBlocks.length - 1].text! : null;
  } catch (err) {
    console.error('Claude web-search request failed:', err);
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/claude-web-search.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/claude.ts tests/claude-web-search.test.ts
git commit -m "feat(research): askClaudeWithWebSearch helper (web_search_20260209 server tool)"
```

---

### Task 3: Research module — `src/lib/outreach/research.ts`

**Files:**
- Create: `src/lib/outreach/research.ts`
- Test: `tests/research.test.ts`

**Interfaces:**
- Consumes: `askClaudeWithWebSearch` (Task 2), `isClaudeConfigured` from `@/lib/claude`.
- Produces (used by Tasks 4–6):
  - `NOTHING_FOUND = 'NOTHING FOUND'`
  - `RESEARCH_FRESH_DAYS = 30`
  - `usableResearch(notes: string | null | undefined): string | null` — trimmed notes, or null when empty/sentinel.
  - `isResearchFresh(researchedAt: string | null | undefined, now?: Date): boolean`
  - `researchLead(db, lead, askFn?): Promise<string | null>` — runs research, writes both columns, returns the stored notes (may be the sentinel); null on failure (columns untouched).
  - `ensureFreshResearch(db, lead, askFn?): Promise<string | null>` — freshness-aware, fail-open; returns USABLE notes for drafting or null.
  - `type ResearchLeadFields = { id: number; business_name: string | null; contact_person: string | null; city: string | null; state: string | null; website: string | null; category: string | null; research_notes?: string | null; researched_at?: string | null }`

- [ ] **Step 1: Write the failing test**

```ts
// tests/research.test.ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { initDb } from '@/lib/db';
import {
  NOTHING_FOUND, usableResearch, isResearchFresh, researchLead, ensureFreshResearch,
} from '@/lib/outreach/research';

function makeDb() {
  const dir = mkdtempSync(path.join(tmpdir(), 'cp-research-'));
  const db = initDb(path.join(dir, 'test.db'));
  db.prepare(
    `INSERT INTO leads (business_name, contact_person, city, state, website, source)
     VALUES ('Acme Lawn Care', 'Bob', 'Hendersonville', 'TN', 'https://acmelawn.example', 'other')`
  ).run();
  const lead = db.prepare('SELECT * FROM leads WHERE id = 1').get() as never;
  return { db, lead };
}

describe('usableResearch', () => {
  it('returns null for empty, whitespace, or the sentinel', () => {
    expect(usableResearch(null)).toBeNull();
    expect(usableResearch('  ')).toBeNull();
    expect(usableResearch(NOTHING_FOUND)).toBeNull();
    expect(usableResearch(`  ${NOTHING_FOUND}\n`)).toBeNull();
  });
  it('returns trimmed notes otherwise', () => {
    expect(usableResearch(' - fact (url)\n')).toBe('- fact (url)');
  });
});

describe('isResearchFresh', () => {
  const now = new Date('2026-07-08T12:00:00Z');
  it('true within 30 days, false outside or missing', () => {
    expect(isResearchFresh('2026-07-01T00:00:00Z', now)).toBe(true);
    expect(isResearchFresh('2026-05-01T00:00:00Z', now)).toBe(false);
    expect(isResearchFresh(null, now)).toBe(false);
  });
});

describe('researchLead', () => {
  it('stores notes + timestamp and returns them', async () => {
    const { db, lead } = makeDb();
    const notes = await researchLead(db, lead, async () => '- They opened a 2nd location (https://news.example)');
    expect(notes).toContain('2nd location');
    const row = db.prepare('SELECT research_notes, researched_at FROM leads WHERE id = 1').get() as {
      research_notes: string; researched_at: string;
    };
    expect(row.research_notes).toContain('2nd location');
    expect(row.researched_at).toBeTruthy();
    db.close();
  });

  it('stores the sentinel when the model finds nothing', async () => {
    const { db, lead } = makeDb();
    const notes = await researchLead(db, lead, async () => `${NOTHING_FOUND}`);
    expect(notes).toBe(NOTHING_FOUND);
    db.close();
  });

  it('returns null and writes nothing on ask failure', async () => {
    const { db, lead } = makeDb();
    const notes = await researchLead(db, lead, async () => null);
    expect(notes).toBeNull();
    const row = db.prepare('SELECT research_notes, researched_at FROM leads WHERE id = 1').get() as {
      research_notes: string | null; researched_at: string | null;
    };
    expect(row.research_notes).toBeNull();
    expect(row.researched_at).toBeNull();
    db.close();
  });
});

describe('ensureFreshResearch', () => {
  it('skips the ask when research is fresh and returns usable notes', async () => {
    const { db } = makeDb();
    db.prepare("UPDATE leads SET research_notes = '- cached fact', researched_at = datetime('now') WHERE id = 1").run();
    const lead = db.prepare('SELECT * FROM leads WHERE id = 1').get() as never;
    let called = 0;
    const notes = await ensureFreshResearch(db, lead, async () => { called++; return '- new'; });
    expect(notes).toBe('- cached fact');
    expect(called).toBe(0);
    db.close();
  });

  it('skips the ask when a fresh sentinel is stored, returning null', async () => {
    const { db } = makeDb();
    db.prepare("UPDATE leads SET research_notes = 'NOTHING FOUND', researched_at = datetime('now') WHERE id = 1").run();
    const lead = db.prepare('SELECT * FROM leads WHERE id = 1').get() as never;
    let called = 0;
    const notes = await ensureFreshResearch(db, lead, async () => { called++; return '- new'; });
    expect(notes).toBeNull();
    expect(called).toBe(0);
    db.close();
  });

  it('fails open: a throwing ask returns null', async () => {
    const { db, lead } = makeDb();
    const notes = await ensureFreshResearch(db, lead, async () => { throw new Error('boom'); });
    expect(notes).toBeNull();
    db.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/research.test.ts`
Expected: FAIL — module `@/lib/outreach/research` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/outreach/research.ts
import type Database from 'better-sqlite3';
import { askClaudeWithWebSearch, isClaudeConfigured } from '@/lib/claude';

export const NOTHING_FOUND = 'NOTHING FOUND';
export const RESEARCH_FRESH_DAYS = 30;

export type ResearchLeadFields = {
  id: number;
  business_name: string | null;
  contact_person: string | null;
  city: string | null;
  state: string | null;
  website: string | null;
  category: string | null;
  research_notes?: string | null;
  researched_at?: string | null;
};

export type ResearchAskFn = (system: string, user: string, maxTokens: number) => Promise<string | null>;

// Notes usable for drafting: non-empty and not the "we looked, nothing there"
// sentinel. Returns the trimmed notes or null.
export function usableResearch(notes: string | null | undefined): string | null {
  const trimmed = (notes ?? '').trim();
  if (!trimmed || trimmed === NOTHING_FOUND) return null;
  return trimmed;
}

export function isResearchFresh(researchedAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!researchedAt) return false;
  const t = Date.parse(researchedAt.includes('T') ? researchedAt : `${researchedAt}Z`.replace(' ', 'T'));
  if (Number.isNaN(t)) return false;
  return now.getTime() - t < RESEARCH_FRESH_DAYS * 86_400_000;
}

export function buildResearchPrompt(lead: ResearchLeadFields): { system: string; user: string } {
  const system = [
    'You are a research assistant preparing personalization notes for polite, professional B2B outreach.',
    'Search the web for TRUE, verifiable, business-only facts about the specific local business described.',
    '',
    'HARD RULES:',
    '- BUSINESS-ONLY. Never include personal-life details about owners or staff (family, health, hobbies, politics, home).',
    '- IDENTITY CHECK. If you cannot confirm a fact is about THIS business in THIS city (not a same-named business elsewhere), drop the fact.',
    '- Only facts you actually found in search results. Never guess or embellish.',
    '',
    'LOOK FOR: what they specifically do or sell, recent news or milestones (new location, award, anniversary, expansion), community involvement or sponsorships, consistent themes in customer reviews, hiring/growth signals.',
    '',
    'OUTPUT FORMAT: 3 to 6 bullet lines, each starting with "- ", each ending with its source URL in parentheses. No preamble, no commentary, no markdown headers.',
    `If nothing passes the rules above, output exactly: ${NOTHING_FOUND}`,
  ].join('\n');

  const parts: string[] = [];
  if (lead.business_name) parts.push(`Business: ${lead.business_name}`);
  if (lead.category) parts.push(`Category / industry: ${lead.category}`);
  const place = [lead.city, lead.state].filter(Boolean).join(', ');
  if (place) parts.push(`Location: ${place}`);
  if (lead.website) parts.push(`Website: ${lead.website}`);
  if (lead.contact_person) parts.push(`Known contact (business role context only): ${lead.contact_person}`);

  return { system, user: ['Research this business:', ...parts].join('\n') };
}

// Run research NOW (no freshness check), persist, and return the stored notes
// (possibly the sentinel). Returns null on failure without touching the row.
export async function researchLead(
  db: Database.Database,
  lead: ResearchLeadFields,
  askFn: ResearchAskFn = askClaudeWithWebSearch
): Promise<string | null> {
  const { system, user } = buildResearchPrompt(lead);
  let raw: string | null = null;
  try {
    raw = await askFn(system, user, 1500);
  } catch (err) {
    console.error(`researchLead(${lead.id}) failed:`, err);
    return null;
  }
  const notes = (raw ?? '').trim();
  if (!notes) return null;
  const stored = notes.toUpperCase().includes(NOTHING_FOUND) && notes.length < 40 ? NOTHING_FOUND : notes;
  db.prepare("UPDATE leads SET research_notes = ?, researched_at = datetime('now') WHERE id = ?")
    .run(stored, lead.id);
  return stored;
}

// Freshness-aware, fail-open entry point used by drafting flows. Returns
// USABLE notes (never the sentinel) or null. Never throws.
export async function ensureFreshResearch(
  db: Database.Database,
  lead: ResearchLeadFields,
  askFn?: ResearchAskFn
): Promise<string | null> {
  try {
    if (isResearchFresh(lead.researched_at)) return usableResearch(lead.research_notes);
    if (!askFn && !isClaudeConfigured()) return usableResearch(lead.research_notes);
    const stored = await researchLead(db, lead, askFn ?? askClaudeWithWebSearch);
    if (stored == null) return usableResearch(lead.research_notes);
    return usableResearch(stored);
  } catch (err) {
    console.error(`ensureFreshResearch(${lead.id}) failed:`, err);
    return usableResearch(lead.research_notes);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/research.test.ts`
Expected: PASS (all describes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/outreach/research.ts tests/research.test.ts
git commit -m "feat(research): researchLead + ensureFreshResearch module"
```

---

### Task 4: Inject researched facts into `generateDraft`

**Files:**
- Modify: `src/lib/outreach/draft.ts` (inside `generateDraft`)
- Modify: `src/lib/queries/outreach-lead-queries.ts` (add fields to `OutreachLead`)
- Test: `tests/draft-research.test.ts`

**Interfaces:**
- Consumes: `usableResearch` (Task 3); `OutreachLead` gains `research_notes: string | null; researched_at: string | null`.
- Produces: `generateDraft` prompt includes a `RESEARCHED FACTS` details section + weaving rules when usable notes exist; byte-identical behavior otherwise.

- [ ] **Step 1: Write the failing test**

`generateDraft` calls `askClaude`; mock the claude module to capture the prompts.

```ts
// tests/draft-research.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const askClaude = vi.fn(async () => 'draft text');
vi.mock('@/lib/claude', () => ({
  askClaude: (...args: unknown[]) => askClaude(...args),
  askClaudeWithWebSearch: vi.fn(),
  isClaudeConfigured: () => true,
}));

import { generateDraft } from '@/lib/outreach/draft';
import type { OutreachLead } from '@/lib/queries/outreach-lead-queries';

// getOutreachPitch reads app_settings; use a real in-memory-ish db
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { initDb } from '@/lib/db';

function lead(extra: Partial<OutreachLead>): OutreachLead {
  return {
    id: 1, business_name: 'Acme Lawn Care', contact_person: 'Bob',
    city: 'Hendersonville', state: 'TN', website: null, segment: null,
    category: 'Landscaping', employee_min: null, employee_max: null,
    lane: null, research_notes: null, researched_at: null,
    ...extra,
  } as OutreachLead;
}

describe('generateDraft research injection', () => {
  let db: ReturnType<typeof initDb>;
  beforeEach(() => {
    askClaude.mockClear();
    const dir = mkdtempSync(path.join(tmpdir(), 'cp-draft-research-'));
    db = initDb(path.join(dir, 'test.db'));
  });

  it('includes RESEARCHED FACTS and weaving rules when notes exist', async () => {
    await generateDraft(db, lead({ research_notes: '- They won Best of Sumner 2026 (https://x.example)' }), 'email');
    const [system, user] = askClaude.mock.calls[0] as unknown as [string, string];
    expect(user).toContain('RESEARCHED FACTS');
    expect(user).toContain('Best of Sumner');
    expect(system).toContain('at most two');
    expect(system).toContain('source URLs');
  });

  it('omits the section for the sentinel or missing notes', async () => {
    await generateDraft(db, lead({ research_notes: 'NOTHING FOUND' }), 'email');
    await generateDraft(db, lead({}), 'email');
    for (const call of askClaude.mock.calls) {
      const [system, user] = call as unknown as [string, string];
      expect(user).not.toContain('RESEARCHED FACTS');
      expect(system).not.toContain('RESEARCHED FACTS');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/draft-research.test.ts`
Expected: FAIL — `user` does not contain `RESEARCHED FACTS`.

- [ ] **Step 3: Write minimal implementation**

3a. In `src/lib/queries/outreach-lead-queries.ts`, add to `interface OutreachLead`:

```ts
  research_notes: string | null;
  researched_at: string | null;
```

3b. In `src/lib/outreach/draft.ts`:

Add import:

```ts
import { usableResearch } from '@/lib/outreach/research';
```

Inside `generateDraft`, before the `systemPrompt` array is built, compute:

```ts
  const research = usableResearch(lead.research_notes);
```

Add one entry to the `systemPrompt` array's OUTPUT RULES section (after the "Never invent specifics" rule):

```ts
    research
      ? '- A RESEARCHED FACTS section lists verified facts about this lead found via web search. Weave in ONE, at most two, of these facts naturally, so the message reads like you did your homework, never like you were watching them. Do not list facts. NEVER include or quote the source URLs in the message.'
      : '',
```

(The array already runs through `.filter(Boolean).join('\n')`, so the empty string disappears when there is no research.)

After the `if (lead.website) details.push(...)` line, add:

```ts
  if (research) {
    details.push('', 'RESEARCHED FACTS (verified via web search, with sources; you may reference these):', research);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/draft-research.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Run the full suite (regression check)**

Run: `npm test`
Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/outreach/draft.ts src/lib/queries/outreach-lead-queries.ts tests/draft-research.test.ts
git commit -m "feat(research): generateDraft weaves in researched facts"
```

---

### Task 5: Letter batch researches leads before drafting

**Files:**
- Modify: `src/lib/queries/letter-batch-queries.ts` (`LetterLead` + `SELECT`)
- Modify: `src/lib/outreach/letter-batch.ts` (`LetterTickOpts` + `runLetterBatchTick` draft loop)
- Test: `tests/letter-batch.test.ts` (add one test to the existing file)

**Interfaces:**
- Consumes: `ensureFreshResearch` (Task 3).
- Produces: `LetterTickOpts.researchFn?: (db: Database.Database, lead: LetterLead) => Promise<string | null>` test seam; `LetterLead` gains `research_notes: string | null; researched_at: string | null`.

- [ ] **Step 1: Write the failing test**

Add to `tests/letter-batch.test.ts` (follow the file's existing setup helpers for creating a db and eligible leads — reuse whatever helper the existing tests use to insert an eligible lead; the assertions below are the contract):

```ts
it('researches a lead before drafting its letter and passes notes to the draft', async () => {
  // Arrange: one eligible lead with no draft_letter (reuse the file's existing
  // eligible-lead insert helper), letter batch enabled.
  const researched: number[] = [];
  const seenNotes: (string | null)[] = [];
  const result = await runLetterBatchTick(db, {
    now: new Date('2026-07-08T13:00:00Z'),
    transport: fakeTransport,           // reuse the file's existing fake transport
    from: 'test@example.com',
    researchFn: async (_d, lead) => {
      researched.push(lead.id);
      return '- researched fact (https://x.example)';
    },
    draftFn: async (_d, lead) => {
      seenNotes.push((lead as { research_notes?: string | null }).research_notes ?? null);
      return 'letter text';
    },
  });
  expect(result.sent).toBe(1);
  expect(researched).toHaveLength(1);
  expect(seenNotes[0]).toContain('researched fact');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/letter-batch.test.ts`
Expected: FAIL — `researchFn` is not a known option / notes never reach `draftFn`.

- [ ] **Step 3: Write minimal implementation**

3a. `src/lib/queries/letter-batch-queries.ts` — add to `LetterLead`:

```ts
  research_notes: string | null; researched_at: string | null;
```

and add `research_notes, researched_at` to the `SELECT` column list.

3b. `src/lib/outreach/letter-batch.ts`:

Import:

```ts
import { ensureFreshResearch } from '@/lib/outreach/research';
```

Add to `LetterTickOpts` (next to `draftFn`):

```ts
  // Test seam; production uses ensureFreshResearch (fail-open, freshness-aware).
  researchFn?: (db: Database.Database, lead: LetterLead) => Promise<string | null>;
```

In `runLetterBatchTick`, next to the `draft` fallback:

```ts
  const research = opts.researchFn
    ?? ((d: Database.Database, l: LetterLead) => ensureFreshResearch(d, l));
```

In the draft loop, replace the drafting branch body (the part after the `if (candidate.draft_letter?.trim())` early-continue) with:

```ts
    let toDraft = candidate;
    try {
      const notes = await research(db, candidate);
      if (notes) toDraft = { ...candidate, research_notes: notes };
    } catch { /* fail-open: draft without research */ }
    let text: string | null = null;
    try { text = await draft(db, toDraft, 'letter'); } catch { text = null; }
```

(The rest of the branch — `saveLetterDraft` / `ready.push` / `skippedDrafts++` — is unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/letter-batch.test.ts`
Expected: PASS, including all pre-existing tests in the file (they don't pass `researchFn`; the production fallback `ensureFreshResearch` short-circuits via `isClaudeConfigured()` false in tests, so they must stay green with no API calls).

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/letter-batch-queries.ts src/lib/outreach/letter-batch.ts tests/letter-batch.test.ts
git commit -m "feat(research): letter batch researches leads before drafting"
```

---

### Task 6: API — research in `draft` action + new `research` action

**Files:**
- Modify: `src/app/api/outreach/leads/route.ts`

**Interfaces:**
- Consumes: `ensureFreshResearch`, `researchLead`, `NOTHING_FOUND` (Task 3).
- Produces: `POST /api/outreach/leads` `{action:'research', leadId}` → `{ok: true, notes, researchedAt}`; `{action:'draft'}` now researches first (fail-open).

- [ ] **Step 1: Implement**

Import at the top of `route.ts`:

```ts
import { ensureFreshResearch, researchLead } from '@/lib/outreach/research';
```

In `case 'draft'`, after the lead-not-found guard and before `generateDraft`, replace:

```ts
      const draft = await generateDraft(db, lead, body.channel);
```

with:

```ts
      await ensureFreshResearch(db, lead); // fail-open; never blocks drafting
      const fresh = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId) as OutreachLead;
      const draft = await generateDraft(db, fresh, body.channel);
```

Add a new case before `default:`:

```ts
    case 'research': {
      const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId) as OutreachLead | undefined;
      if (!lead) {
        return NextResponse.json({ error: 'lead not found' }, { status: 404 });
      }
      const notes = await researchLead(db, lead); // manual button: always re-runs
      if (notes == null) {
        return NextResponse.json({ error: 'research failed' }, { status: 502 });
      }
      const row = db.prepare('SELECT researched_at FROM leads WHERE id = ?').get(leadId) as { researched_at: string };
      return NextResponse.json({ ok: true, notes, researchedAt: row.researched_at });
    }
```

- [ ] **Step 2: Type-check and run the suite**

Run: `npx tsc --noEmit 2>&1 | head -20 || true` then `npm test`
Expected: no new type errors in `route.ts`; all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/outreach/leads/route.ts
git commit -m "feat(research): research action + auto-research in draft action"
```

---

### Task 7: UI — editable Research box on each lead

**Files:**
- Modify: `src/components/outreach-leads.tsx`

**Interfaces:**
- Consumes: `{action:'research'}` (Task 6). This task also adds `{action:'save-research', leadId, notes}` to the API (Step 1 below) so hand-edits to the notes persist.

- [ ] **Step 1: Add `save-research` action to `route.ts`**

```ts
    case 'save-research': {
      if (typeof body.notes !== 'string') {
        return NextResponse.json({ error: 'invalid notes' }, { status: 400 });
      }
      db.prepare('UPDATE leads SET research_notes = ? WHERE id = ?').run(body.notes.trim() || null, leadId);
      break;
    }
```

(Editing notes deliberately does NOT touch `researched_at` — a hand-edit isn't a fresh research run.)

- [ ] **Step 2: Add the Research box to `outreach-leads.tsx`**

Read the component first and follow its existing conventions exactly (styling classes, how draft boxes do edit/save state, how the component refreshes lead data after an API call). Place the box in the per-lead expanded/detail area alongside the draft boxes. Contract:

- Shows `research_notes` in a `<textarea>` (or the file's equivalent editable pattern) with a muted "researched {date}" stamp from `researched_at`; shows an empty state ("No research yet") when null.
- A **Research** button (label **Re-research** when notes exist) that POSTs `{action:'research', leadId}`, shows a loading state, and on success updates the box with the returned `notes`; on failure shows the file's standard error affordance.
- A **Save** control that POSTs `{action:'save-research', leadId, notes}` with the textarea contents.

Reference snippet to adapt (adjust names/classes to the file's conventions):

```tsx
function ResearchBox({ lead, onChanged }: { lead: OutreachLead; onChanged: () => void }) {
  const [notes, setNotes] = useState(lead.research_notes ?? '');
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/outreach/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'research', leadId: lead.id }),
      });
      const data = await res.json();
      if (res.ok) { setNotes(data.notes); onChanged(); }
    } finally { setBusy(false); }
  };
  const save = async () => {
    await fetch('/api/outreach/leads', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save-research', leadId: lead.id, notes }),
    });
    onChanged();
  };
  /* render textarea + stamp + buttons per file conventions */
}
```

- [ ] **Step 3: Verify locally**

Run: `npm run dev`, open the Outreach Leads tab, expand a lead:
- Research box renders with empty state.
- (If `ANTHROPIC_API_KEY` is set locally) clicking Research populates notes; editing + Save persists across reload.

- [ ] **Step 4: Build check and commit**

Run: `npm run build`
Expected: clean build.

```bash
git add src/components/outreach-leads.tsx src/app/api/outreach/leads/route.ts
git commit -m "feat(research): editable Research box + Re-research button on leads"
```

---

### Task 8: Ship + live verification

**Files:** none new (merge/deploy/ops)

- [ ] **Step 1: Full suite + build**

Run: `npm test && npm run build`
Expected: everything green.

- [ ] **Step 2: Merge to main and deploy**

```bash
git fetch origin
git rebase origin/main          # if origin/main advanced
git push origin feat/prospect-research:main
cd ~/commandpost && git pull origin main && ./scripts/deploy.sh
```

(Never run two `next build`s concurrently on the server — if Phil is deploying, wait.)

- [ ] **Step 3: Live verification (spec §8)**

On https://commandpost.rekindleleads.com, pick 3 un-drafted leads with different web footprints (strong / weak / none):

1. Click **Research** on each — expect real bullet facts with URLs for the strong one, and `NOTHING FOUND` (or thin notes) for the ghost.
2. Delete any wrong/creepy fact, Save.
3. Click **Draft** (letter or email) — verify the draft weaves in 1–2 facts naturally, no URLs, and the no-research lead drafts exactly like before.
4. Confirm cost sanity in the Anthropic console (a few cents total).

- [ ] **Step 4: Verify the next letter batch**

After the next 13:00 UTC letter-batch run, check the batch email to Caroline: letters for researched leads should reference a researched fact; `runLetterBatchTick` must have completed even if any research call failed (check PM2 logs: `pm2 logs commandpost --lines 100`).
