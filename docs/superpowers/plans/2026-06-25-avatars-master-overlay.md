# Avatars Master Profile + Vertical Overlay — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace CommandPost's flat avatar model with a Master Profile (singleton) + Vertical Overlay (one-at-a-time) architecture that drives content generation with enforced objection-handling and proof-injection rules.

**Architecture:** A new `master_profile` singleton table holds the universal layer; the existing `avatars` table is extended with structured columns to become "vertical overlays." A `composeAudience(master, vertical)` function builds the system-context string (master always + one vertical + content rules) which is passed to the existing `generateContent({ audience })`. Generation code itself is untouched — all rules live in the composed audience string. Seed data loads idempotently in production only.

**Tech Stack:** Next.js 16, better-sqlite3, Vitest, React 19, Tailwind.

**Spec:** `docs/superpowers/specs/2026-06-25-avatars-master-overlay-design.md`

**Key conventions (already in this repo):**
- Tests: Vitest, files in `tests/`, in-memory DB via `initDb(':memory:')`. Run a single file: `npx vitest run tests/<file>.test.ts`.
- Migrations live inside `initDb()` in `src/lib/db.ts` and use guarded `ALTER TABLE ... ADD COLUMN`.
- `initDb()` builds **schema only** (runs for tests too). Data **seeding** runs only in `getDb()` (production path) so unit tests start from an empty DB.
- Commit after every task.

---

## File Structure

- `src/lib/types.ts` — add `MasterProfile`, `MasterObjection`, `MasterProfileInput`; extend `Avatar`, `AvatarInput`.
- `src/lib/db.ts` — extend `avatars` columns + add `master_profile` table (in `initDb`); call seed in `getDb`.
- `src/lib/queries/master-queries.ts` — **new** `getMasterProfile`, `upsertMasterProfile`.
- `src/lib/queries/avatar-queries.ts` — parse/serialize the new structured fields.
- `src/lib/seed/marketing-avatars.ts` — **new** seed data (Master + 4 overlays) + `seedMarketingAvatars(db)`.
- `src/lib/generation/audience.ts` — replace with `composeAudience(...)`.
- `src/app/api/master/route.ts` — **new** GET/PUT.
- `src/app/api/avatars/route.ts` + `[id]/route.ts` — accept new fields.
- `src/app/api/generate/route.ts` — use `composeAudience`.
- `src/components/master-profile-editor.tsx` — **new** editor.
- `src/components/avatar-manager.tsx` — structured-field editor.
- `src/components/generate-studio.tsx` — picker label tweak.
- `src/app/(dashboard)/avatars/page.tsx` — render master + verticals.
- Tests: `tests/queries/master-queries.test.ts`, `tests/queries/avatar-queries.test.ts`, `tests/generation/audience.test.ts`, `tests/seed/marketing-avatars.test.ts`.

---

## Task 1: Types

**Files:**
- Modify: `src/lib/types.ts` (the `Avatar` interface at ~line 355)

- [ ] **Step 1: Add the new interfaces and extend `Avatar`/`AvatarInput`**

Replace the existing `Avatar` interface with the extended version and add the master types above/below it:

```ts
export interface MasterObjection {
  objection: string;
  counter: string;
}

export interface MasterProfile {
  id: number; // always 1
  identity: string | null;
  wants: string | null;
  burned_by: string | null;
  buying_trigger: string | null;
  tone: string | null;
  objections: MasterObjection[];
  trust_builders: string[];
  updated_at: string;
}

export interface MasterProfileInput {
  identity?: string | null;
  wants?: string | null;
  burned_by?: string | null;
  buying_trigger?: string | null;
  tone?: string | null;
  objections?: MasterObjection[];
  trust_builders?: string[];
}

export interface Avatar {
  id: number;
  name: string;
  summary: string | null;
  description: string | null;
  tone: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
  // Vertical-overlay structured fields (nullable / default empty)
  persona: string | null;
  buying_trigger: string | null;
  proof_point: string | null;
  writing_target: string | null;
  what_tried: string | null;
  pains: string[];
  desires: string[];
  objections: string[];
  vocabulary: string[];
  trust_triggers: string[];
  channels: string[];
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` (expect errors in `avatar-queries.ts` / `audience.ts` — those are fixed in later tasks; confirm no error inside `types.ts` itself).

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(avatars): add MasterProfile + structured Avatar types"
```

---

## Task 2: Schema migration (columns + master_profile table)

**Files:**
- Modify: `src/lib/db.ts` (the avatars migration block at ~line 757; `getDb` at ~line 782)

- [ ] **Step 1: Add an add-column helper and new columns + table inside `initDb`**

Immediately AFTER the existing `CREATE TABLE IF NOT EXISTS avatars (...)` block (ends ~line 769), insert:

```ts
  // Migration: structured vertical-overlay fields on avatars (additive, nullable)
  const addAvatarCol = (col: string, decl: string) => {
    const has = db
      .prepare("SELECT COUNT(*) as count FROM pragma_table_info('avatars') WHERE name = ?")
      .get(col) as { count: number };
    if (has.count === 0) db.exec(`ALTER TABLE avatars ADD COLUMN ${col} ${decl}`);
  };
  addAvatarCol('persona', 'TEXT');
  addAvatarCol('buying_trigger', 'TEXT');
  addAvatarCol('proof_point', 'TEXT');
  addAvatarCol('writing_target', 'TEXT');
  addAvatarCol('what_tried', 'TEXT');
  addAvatarCol('pains', "TEXT NOT NULL DEFAULT '[]'");
  addAvatarCol('desires', "TEXT NOT NULL DEFAULT '[]'");
  addAvatarCol('objections', "TEXT NOT NULL DEFAULT '[]'");
  addAvatarCol('vocabulary', "TEXT NOT NULL DEFAULT '[]'");
  addAvatarCol('trust_triggers', "TEXT NOT NULL DEFAULT '[]'");
  addAvatarCol('channels', "TEXT NOT NULL DEFAULT '[]'");

  // Migration: master_profile singleton (id is always 1)
  db.exec(`
    CREATE TABLE IF NOT EXISTS master_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      identity TEXT,
      wants TEXT,
      burned_by TEXT,
      buying_trigger TEXT,
      tone TEXT,
      objections TEXT NOT NULL DEFAULT '[]',
      trust_builders TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
```

- [ ] **Step 2: Verify schema builds on a fresh in-memory DB**

Run: `npx vitest run tests/queries/notification-queries.test.ts`
Expected: PASS (this proves `initDb(':memory:')` still builds without error after the migration edit).

- [ ] **Step 3: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat(avatars): migrate structured columns + master_profile table"
```

---

## Task 3: master-queries (TDD)

**Files:**
- Create: `src/lib/queries/master-queries.ts`
- Test: `tests/queries/master-queries.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { initDb } from '@/lib/db';
import { getMasterProfile, upsertMasterProfile } from '@/lib/queries/master-queries';
import type Database from 'better-sqlite3';

let db: Database.Database;
beforeEach(() => { db = initDb(':memory:'); });

describe('getMasterProfile', () => {
  it('returns null when unset', () => {
    expect(getMasterProfile(db)).toBeNull();
  });
});

describe('upsertMasterProfile', () => {
  it('inserts then reads back with parsed arrays', () => {
    upsertMasterProfile(db, {
      identity: 'Owner-operator',
      tone: 'Direct',
      objections: [{ objection: 'Sounds robotic', counter: 'Show voice fidelity' }],
      trust_builders: ['Real working thing', 'Plain English'],
    });
    const m = getMasterProfile(db)!;
    expect(m.id).toBe(1);
    expect(m.identity).toBe('Owner-operator');
    expect(m.objections).toEqual([{ objection: 'Sounds robotic', counter: 'Show voice fidelity' }]);
    expect(m.trust_builders).toEqual(['Real working thing', 'Plain English']);
  });

  it('updates the same singleton row (id stays 1)', () => {
    upsertMasterProfile(db, { identity: 'first' });
    upsertMasterProfile(db, { identity: 'second', wants: 'time back' });
    const m = getMasterProfile(db)!;
    expect(m.id).toBe(1);
    expect(m.identity).toBe('second');
    expect(m.wants).toBe('time back');
    const count = db.prepare('SELECT COUNT(*) c FROM master_profile').get() as { c: number };
    expect(count.c).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/queries/master-queries.test.ts`
Expected: FAIL — cannot find module `master-queries`.

- [ ] **Step 3: Implement `master-queries.ts`**

```ts
import type Database from 'better-sqlite3';
import type { MasterProfile, MasterProfileInput, MasterObjection } from '@/lib/types';

function parseObjections(v: unknown): MasterObjection[] {
  if (typeof v !== 'string' || !v) return [];
  try {
    const a = JSON.parse(v);
    return Array.isArray(a)
      ? a.filter((o) => o && typeof o.objection === 'string').map((o) => ({ objection: String(o.objection), counter: String(o.counter ?? '') }))
      : [];
  } catch { return []; }
}

function parseStrings(v: unknown): string[] {
  if (typeof v !== 'string' || !v) return [];
  try { const a = JSON.parse(v); return Array.isArray(a) ? a.map(String) : []; } catch { return []; }
}

export function getMasterProfile(db: Database.Database): MasterProfile | null {
  const row = db.prepare('SELECT * FROM master_profile WHERE id = 1').get() as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: 1,
    identity: (row.identity as string) ?? null,
    wants: (row.wants as string) ?? null,
    burned_by: (row.burned_by as string) ?? null,
    buying_trigger: (row.buying_trigger as string) ?? null,
    tone: (row.tone as string) ?? null,
    objections: parseObjections(row.objections),
    trust_builders: parseStrings(row.trust_builders),
    updated_at: (row.updated_at as string) ?? '',
  };
}

export function upsertMasterProfile(db: Database.Database, input: MasterProfileInput): void {
  db.prepare(
    `INSERT INTO master_profile (id, identity, wants, burned_by, buying_trigger, tone, objections, trust_builders, updated_at)
     VALUES (1, @identity, @wants, @burned_by, @buying_trigger, @tone, @objections, @trust_builders, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       identity=@identity, wants=@wants, burned_by=@burned_by, buying_trigger=@buying_trigger,
       tone=@tone, objections=@objections, trust_builders=@trust_builders, updated_at=datetime('now')`
  ).run({
    identity: input.identity ?? null,
    wants: input.wants ?? null,
    burned_by: input.burned_by ?? null,
    buying_trigger: input.buying_trigger ?? null,
    tone: input.tone ?? null,
    objections: JSON.stringify(input.objections ?? []),
    trust_builders: JSON.stringify(input.trust_builders ?? []),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/queries/master-queries.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/master-queries.ts tests/queries/master-queries.test.ts
git commit -m "feat(avatars): master-queries get/upsert singleton"
```

---

## Task 4: Extend avatar-queries with structured fields (TDD)

**Files:**
- Modify: `src/lib/queries/avatar-queries.ts`
- Test: `tests/queries/avatar-queries.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { initDb } from '@/lib/db';
import { createAvatar, getAvatar, listAvatars, updateAvatar } from '@/lib/queries/avatar-queries';
import type Database from 'better-sqlite3';

let db: Database.Database;
beforeEach(() => { db = initDb(':memory:'); });

describe('createAvatar with structured fields', () => {
  it('round-trips arrays and scalars', () => {
    const id = createAvatar(db, {
      name: 'Fee-Only RIA',
      persona: 'David, the Fiduciary',
      proof_point: 'PWI',
      writing_target: 'Write to a fee-only fiduciary…',
      pains: ['Content marketing is a slog', 'Compliance eats hours'],
      objections: ['Compliance / SEC'],
      vocabulary: ['fiduciary', 'AUM'],
      channels: ['LinkedIn', 'email'],
    });
    const a = getAvatar(db, id)!;
    expect(a.persona).toBe('David, the Fiduciary');
    expect(a.proof_point).toBe('PWI');
    expect(a.pains).toEqual(['Content marketing is a slog', 'Compliance eats hours']);
    expect(a.objections).toEqual(['Compliance / SEC']);
    expect(a.vocabulary).toEqual(['fiduciary', 'AUM']);
    expect(a.channels).toEqual(['LinkedIn', 'email']);
  });

  it('defaults arrays to [] when omitted (legacy-style avatar)', () => {
    const id = createAvatar(db, { name: 'Old Persona', summary: 'sparse' });
    const a = getAvatar(db, id)!;
    expect(a.pains).toEqual([]);
    expect(a.vocabulary).toEqual([]);
    expect(a.persona).toBeNull();
  });
});

describe('updateAvatar with structured fields', () => {
  it('overwrites arrays', () => {
    const id = createAvatar(db, { name: 'X', vocabulary: ['a'] });
    updateAvatar(db, id, { name: 'X', vocabulary: ['b', 'c'] });
    expect(getAvatar(db, id)!.vocabulary).toEqual(['b', 'c']);
  });
});

describe('listAvatars', () => {
  it('parses arrays for every row', () => {
    createAvatar(db, { name: 'A', pains: ['p1'] });
    const all = listAvatars(db);
    expect(all[0].pains).toEqual(['p1']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/queries/avatar-queries.test.ts`
Expected: FAIL — `AvatarInput` has no `persona`/`pains`/etc., and rows return raw JSON strings.

- [ ] **Step 3: Rewrite `avatar-queries.ts`**

```ts
import type Database from 'better-sqlite3';
import type { Avatar } from '@/lib/types';

export interface AvatarInput {
  name: string;
  summary?: string | null;
  description?: string | null;
  tone?: string | null;
  is_active?: boolean;
  persona?: string | null;
  buying_trigger?: string | null;
  proof_point?: string | null;
  writing_target?: string | null;
  what_tried?: string | null;
  pains?: string[];
  desires?: string[];
  objections?: string[];
  vocabulary?: string[];
  trust_triggers?: string[];
  channels?: string[];
}

function parseArray(v: unknown): string[] {
  if (typeof v !== 'string' || !v) return [];
  try { const a = JSON.parse(v); return Array.isArray(a) ? a.map(String) : []; } catch { return []; }
}

function mapRow(row: Record<string, unknown>): Avatar {
  return {
    id: row.id as number,
    name: row.name as string,
    summary: (row.summary as string) ?? null,
    description: (row.description as string) ?? null,
    tone: (row.tone as string) ?? null,
    is_active: row.is_active as number,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    persona: (row.persona as string) ?? null,
    buying_trigger: (row.buying_trigger as string) ?? null,
    proof_point: (row.proof_point as string) ?? null,
    writing_target: (row.writing_target as string) ?? null,
    what_tried: (row.what_tried as string) ?? null,
    pains: parseArray(row.pains),
    desires: parseArray(row.desires),
    objections: parseArray(row.objections),
    vocabulary: parseArray(row.vocabulary),
    trust_triggers: parseArray(row.trust_triggers),
    channels: parseArray(row.channels),
  };
}

function writeParams(input: AvatarInput) {
  return {
    name: input.name,
    summary: input.summary ?? null,
    description: input.description ?? null,
    tone: input.tone ?? null,
    is_active: input.is_active === false ? 0 : 1,
    persona: input.persona ?? null,
    buying_trigger: input.buying_trigger ?? null,
    proof_point: input.proof_point ?? null,
    writing_target: input.writing_target ?? null,
    what_tried: input.what_tried ?? null,
    pains: JSON.stringify(input.pains ?? []),
    desires: JSON.stringify(input.desires ?? []),
    objections: JSON.stringify(input.objections ?? []),
    vocabulary: JSON.stringify(input.vocabulary ?? []),
    trust_triggers: JSON.stringify(input.trust_triggers ?? []),
    channels: JSON.stringify(input.channels ?? []),
  };
}

export function createAvatar(db: Database.Database, input: AvatarInput): number {
  const result = db.prepare(
    `INSERT INTO avatars
       (name, summary, description, tone, is_active, persona, buying_trigger, proof_point,
        writing_target, what_tried, pains, desires, objections, vocabulary, trust_triggers, channels)
     VALUES
       (@name, @summary, @description, @tone, @is_active, @persona, @buying_trigger, @proof_point,
        @writing_target, @what_tried, @pains, @desires, @objections, @vocabulary, @trust_triggers, @channels)`
  ).run(writeParams(input));
  return Number(result.lastInsertRowid);
}

export function listAvatars(db: Database.Database, activeOnly = false): Avatar[] {
  const sql = activeOnly
    ? 'SELECT * FROM avatars WHERE is_active = 1 ORDER BY name COLLATE NOCASE'
    : 'SELECT * FROM avatars ORDER BY name COLLATE NOCASE';
  return (db.prepare(sql).all() as Record<string, unknown>[]).map(mapRow);
}

export function getAvatar(db: Database.Database, id: number): Avatar | undefined {
  const row = db.prepare('SELECT * FROM avatars WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? mapRow(row) : undefined;
}

export function updateAvatar(db: Database.Database, id: number, input: AvatarInput): void {
  db.prepare(
    `UPDATE avatars SET
       name=@name, summary=@summary, description=@description, tone=@tone, is_active=@is_active,
       persona=@persona, buying_trigger=@buying_trigger, proof_point=@proof_point,
       writing_target=@writing_target, what_tried=@what_tried,
       pains=@pains, desires=@desires, objections=@objections, vocabulary=@vocabulary,
       trust_triggers=@trust_triggers, channels=@channels, updated_at=datetime('now')
     WHERE id=@id`
  ).run({ id, ...writeParams(input) });
}

export function deleteAvatar(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM avatars WHERE id = ?').run(id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/queries/avatar-queries.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/avatar-queries.ts tests/queries/avatar-queries.test.ts
git commit -m "feat(avatars): structured fields in avatar-queries"
```

---

## Task 5: composeAudience (TDD)

**Files:**
- Modify: `src/lib/generation/audience.ts` (full replace)
- Test: `tests/generation/audience.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { composeAudience } from '@/lib/generation/audience';
import type { Avatar, MasterProfile } from '@/lib/types';

const MASTER: MasterProfile = {
  id: 1, identity: 'Owner-operator', wants: 'time back', burned_by: 'agencies',
  buying_trigger: 'a missed lead', tone: 'Direct, plainspoken',
  objections: [{ objection: 'Sounds robotic', counter: 'Show voice fidelity' }],
  trust_builders: ['Real working thing'], updated_at: '',
};

const RIA: Avatar = {
  id: 2, name: 'Fee-Only RIA', summary: null, description: null, tone: null, is_active: 1,
  created_at: '', updated_at: '', persona: 'David, the Fiduciary', buying_trigger: 'marketing is the bottleneck',
  proof_point: 'PWI', writing_target: 'Write to a fee-only fiduciary…', what_tried: 'generic agency',
  pains: ['Content is a slog'], desires: ['Engine that scales his voice'], objections: ['Compliance / SEC'],
  vocabulary: ['fiduciary', 'AUM'], trust_triggers: ['You get fee-only'], channels: ['LinkedIn'],
};

const CHIRO: Avatar = { ...RIA, id: 3, name: 'Chiropractor', vocabulary: ['PVA', 'no-shows'] };

describe('composeAudience', () => {
  it('master-only includes master block, no vertical block', () => {
    const out = composeAudience(MASTER, null);
    expect(out).toContain('Master audience profile');
    expect(out).toContain('Owner-operator');
    expect(out).not.toContain('Vertical overlay');
  });

  it('master + vertical anchors the writing target and applies both content rules', () => {
    const out = composeAudience(MASTER, RIA);
    expect(out).toContain('Master audience profile');
    expect(out).toContain('Vertical overlay — Fee-Only RIA');
    expect(out).toContain('Writing target');
    expect(out).toContain('Write to a fee-only fiduciary');
    expect(out).toContain('one universal (master) objection');
    expect(out).toContain('one vertical-specific objection');
    expect(out).toContain('PWI'); // proof injection
  });

  it('does not merge two verticals — only the selected vocabulary appears', () => {
    const out = composeAudience(MASTER, RIA);
    expect(out).toContain('fiduciary');
    expect(out).not.toContain('PVA');
  });

  it('all-verticals mode lists names but does not merge vocabularies', () => {
    const out = composeAudience(MASTER, null, { allVerticals: [RIA, CHIRO] });
    expect(out).toContain('GENERIC mode');
    expect(out).toContain('Fee-Only RIA, Chiropractor');
    expect(out).not.toContain('fiduciary');
    expect(out).not.toContain('PVA');
  });

  it('returns empty string when no master and no vertical', () => {
    expect(composeAudience(null, null)).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/generation/audience.test.ts`
Expected: FAIL — `composeAudience` not exported.

- [ ] **Step 3: Replace `audience.ts`**

```ts
import type { Avatar, MasterProfile } from '@/lib/types';

function bullets(items: string[]): string {
  return items.map((i) => `- ${i}`).join('\n');
}

function masterBlock(m: MasterProfile): string {
  const parts: string[] = ['## Master audience profile (applies to every piece)'];
  if (m.identity) parts.push(`Who they are: ${m.identity}`);
  if (m.wants) parts.push(`What they want: ${m.wants}`);
  if (m.burned_by) parts.push(`How they've been burned: ${m.burned_by}`);
  if (m.buying_trigger) parts.push(`Buying trigger: ${m.buying_trigger}`);
  if (m.trust_builders.length) parts.push(`What earns their trust:\n${bullets(m.trust_builders)}`);
  if (m.objections.length) {
    const lines = m.objections.map((o) => `- "${o.objection}" → ${o.counter}`).join('\n');
    parts.push(`Universal objections (respect these; counter when relevant):\n${lines}`);
  }
  if (m.tone) parts.push(`Tone for all content: ${m.tone}`);
  return parts.join('\n');
}

function verticalBlock(v: Avatar): string {
  const parts: string[] = [`## Vertical overlay — ${v.name}`];
  if (v.persona) parts.push(`Persona: ${v.persona}`);
  if (v.summary) parts.push(v.summary);
  if (v.description) parts.push(v.description);
  if (v.pains.length) parts.push(`Their pain (in their words):\n${bullets(v.pains)}`);
  if (v.desires.length) parts.push(`Desired outcome:\n${bullets(v.desires)}`);
  if (v.objections.length) parts.push(`Vertical-specific objections:\n${bullets(v.objections)}`);
  if (v.vocabulary.length) parts.push(`Vocabulary to use: ${v.vocabulary.join(', ')}`);
  if (v.trust_triggers.length) parts.push(`Trust triggers:\n${bullets(v.trust_triggers)}`);
  if (v.buying_trigger) parts.push(`Buying trigger: ${v.buying_trigger}`);
  if (v.channels.length) parts.push(`Channels: ${v.channels.join(', ')}`);
  return parts.join('\n');
}

function contentRules(master: MasterProfile | null, vertical: Avatar | null): string {
  const rules: string[] = ['## Content rules (apply to this piece)'];
  const hasMasterObj = !!master && master.objections.length > 0;
  const hasVertObj = !!vertical && vertical.objections.length > 0;
  if (hasMasterObj && hasVertObj) {
    rules.push('- Resolve at least one universal (master) objection using its counter, AND at least one vertical-specific objection.');
  } else if (hasMasterObj) {
    rules.push('- Resolve at least one universal (master) objection using its counter.');
  } else if (hasVertObj) {
    rules.push('- Resolve at least one vertical-specific objection.');
  }
  if (vertical?.proof_point) {
    rules.push(`- Weave in this proof point for credibility: ${vertical.proof_point}.`);
  }
  return rules.length > 1 ? rules.join('\n') : '';
}

/**
 * Build the audience system-context block.
 * - master + vertical: full overlay with anchored writing target + content rules.
 * - master only (vertical null, no allVerticals): just the master layer.
 * - all-verticals (opts.allVerticals): generic, off-spec; names listed, no vocab merge.
 */
export function composeAudience(
  master: MasterProfile | null,
  vertical: Avatar | null,
  opts?: { allVerticals?: Avatar[] }
): string {
  const blocks: string[] = [];
  if (master) blocks.push(masterBlock(master));

  if (vertical) {
    blocks.push(verticalBlock(vertical));
    if (vertical.writing_target) {
      blocks.push(`## Writing target (anchor every sentence to this)\n${vertical.writing_target}`);
    }
  } else if (opts?.allVerticals && opts.allVerticals.length) {
    const names = opts.allVerticals.map((a) => a.name).join(', ');
    blocks.push(
      `## All verticals (GENERIC mode — off-spec)\n` +
      `This piece targets a general audience across these verticals: ${names}. ` +
      `Do NOT blend their specific vocabularies; keep it broadly applicable and lean on the master profile.`
    );
  }

  const rules = contentRules(master, vertical);
  if (rules) blocks.push(rules);

  return blocks.join('\n\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/generation/audience.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/generation/audience.ts tests/generation/audience.test.ts
git commit -m "feat(avatars): composeAudience (master + one vertical + content rules)"
```

---

## Task 6: Seed data + idempotent seeding (TDD)

**Files:**
- Create: `src/lib/seed/marketing-avatars.ts`
- Test: `tests/seed/marketing-avatars.test.ts`
- Modify: `src/lib/db.ts` (`getDb`)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { initDb } from '@/lib/db';
import { seedMarketingAvatars } from '@/lib/seed/marketing-avatars';
import { getMasterProfile } from '@/lib/queries/master-queries';
import { listAvatars, createAvatar } from '@/lib/queries/avatar-queries';
import type Database from 'better-sqlite3';

let db: Database.Database;
beforeEach(() => { db = initDb(':memory:'); });

describe('seedMarketingAvatars', () => {
  it('seeds the master profile and 4 overlays', () => {
    seedMarketingAvatars(db);
    const m = getMasterProfile(db)!;
    expect(m.identity).toBeTruthy();
    expect(m.objections.length).toBe(5);
    const names = listAvatars(db).map((a) => a.name);
    expect(names).toContain('Fee-Only RIA / Financial Advisor');
    expect(names).toContain('Chiropractor / Clinic Owner');
    expect(names).toContain('Faith-Based Nonprofit Leader');
    expect(names).toContain('Home Services Owner');
  });

  it('is idempotent — running twice does not duplicate', () => {
    seedMarketingAvatars(db);
    seedMarketingAvatars(db);
    expect(listAvatars(db).length).toBe(4);
    const count = db.prepare('SELECT COUNT(*) c FROM master_profile').get() as { c: number };
    expect(count.c).toBe(1);
  });

  it('does not touch pre-existing avatars or overwrite an existing master', () => {
    createAvatar(db, { name: 'Pre-Retiree Pete', summary: 'legacy' });
    seedMarketingAvatars(db);
    const names = listAvatars(db).map((a) => a.name);
    expect(names).toContain('Pre-Retiree Pete');
    expect(listAvatars(db).length).toBe(5); // 1 legacy + 4 seeded
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/seed/marketing-avatars.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `marketing-avatars.ts`**

Use the verbatim data from the RekindleLeads doc. Proof points: RIA→PWI, Chiro→Zerona/White House Chiropractic, Nonprofit→GrantCraft / Way Maker Place, Home Services→SkyTrain-adjacent field/lead-gen.

```ts
import type Database from 'better-sqlite3';
import type { AvatarInput } from '@/lib/queries/avatar-queries';
import type { MasterProfileInput } from '@/lib/types';
import { createAvatar } from '@/lib/queries/avatar-queries';
import { upsertMasterProfile, getMasterProfile } from '@/lib/queries/master-queries';

const MASTER: MasterProfileInput = {
  identity:
    'Owner-operator, 38–60, running a $500K–$5M business they built with their own hands. Practitioner first, businessperson second — they got into this to do the work they are good at, not to run marketing. Every hour on admin is stolen from the thing they actually do. Carries a quiet worry they are falling behind on "this AI stuff."',
  wants:
    'The result, not the toolkit. Missed revenue recovered, follow-up that happens without them, and their time back. Time is the real currency — more than money in most cases. They do not want to become a tech person or manage another dashboard.',
  burned_by:
    'Marketing agencies that overpromised and disappeared. SaaS that required a full-time person to operate. "Gurus" selling courses. Anything that smells like hype — they have a finely tuned BS detector.',
  buying_trigger:
    'A specific pain that just cost them money or sleep — a missed lead, a launch they cannot staff, a follow-up that never happened, a busy season they cannot keep up with. They do not buy "AI"; they buy relief from a moment that hurt.',
  tone:
    'Direct, plainspoken, builder-to-owner. No "great question," no hedging, no buzzwords. Confident but not slick. Talk with them, not at them.',
  objections: [
    { objection: 'AI will sound robotic / won\'t sound like me.', counter: 'Show voice fidelity — their words, not the machine\'s.' },
    { objection: 'I\'ve been burned before.', counter: 'Prove it with a real, working build, not promises.' },
    { objection: 'Is this just another thing I have to manage?', counter: 'Frame it done-for-you, runs-without-you.' },
    { objection: 'My business is different / too small for this.', counter: 'Use vertical-specific specifics that prove you get their world.' },
    { objection: 'What\'s the actual ROI?', counter: 'Show concrete recovered-revenue or recovered-time math.' },
  ],
  trust_builders: [
    'Seeing a real, working thing — not slides, not a deck.',
    'Plain English. Zero jargon-dumping.',
    'Someone who asks about their business before talking about themselves.',
    'Relational and local credibility — they buy from people, not vendors.',
    'For faith-based and Middle TN: shared values, relationships over transactions.',
  ],
};

const OVERLAYS: AvatarInput[] = [
  {
    name: 'Fee-Only RIA / Financial Advisor',
    persona: 'David, the Fiduciary. Owns or leads a fee-only RIA; takes pride in being a fiduciary and quietly resents the commission-sales reputation of the broader industry.',
    summary: 'Fee-only registered investment advisor; fiduciary identity.',
    pains: [
      'Content marketing is a slog and I never have time to write.',
      'Compliance review eats hours I don\'t have.',
      'I can\'t scale my voice — everything good comes out of my head.',
      'The big firms outspend me on radio and Google and I can\'t keep up.',
      'Leads are slow and I have no real engine for them.',
    ],
    desires: ['A content and marketing engine that grows AUM without him writing every word and without creating a compliance liability.'],
    objections: ['Compliance (SEC/FINRA): anything AI-generated must be reviewable, archivable, on-brand, and free of promissory language. Lead with respect for this or lose him instantly.'],
    what_tried: 'Hired a generic marketing agency that didn\'t understand compliance and produced unusable copy. Tried writing himself and burned out.',
    vocabulary: ['fiduciary', 'fee-only', 'AUM', 'prospects', 'drip', 'ADV', 'compliance archive', 'suitability', 'fee-only vs. commission', 'ideal client'],
    trust_triggers: ['You understand fee-only vs. commission.', 'You respect compliance as a feature, not a hurdle.', 'You\'ve built for an RIA before (PWI).'],
    buying_trigger: 'He\'s realized his marketing engine is the actual bottleneck to AUM growth, and the manual content/compliance loop can\'t scale.',
    channels: ['LinkedIn', 'email', 'industry podcasts', 'RIA-specific communities', 'referrals'],
    proof_point: 'Paul Winkler Inc (PWI) — a real fee-only RIA marketing engine you built.',
    writing_target: 'Write to a fee-only fiduciary who values doing right by clients, is allergic to hype, and needs everything to clear compliance — show him a marketing engine that scales his voice without scaling his risk.',
  },
  {
    name: 'Chiropractor / Clinic Owner',
    persona: 'Dr. Banning-type. Owns a practice, often single-location. Strong clinically, but marketing is reactive and improvised. Thinks of himself as a doctor, not a marketer.',
    summary: 'Single-location chiropractic / clinic owner.',
    pains: [
      'No-shows are killing my schedule.',
      'Follow-up falls through the cracks the second the front desk gets busy.',
      'I\'m launching a new cash-pay service and have no marketing behind it.',
      'Reactivation? I know I should be doing it. I\'m not.',
      'I\'ve paid for ad packages that never converted.',
    ],
    desires: ['A full patient-acquisition and reactivation system that runs without his front desk having to remember anything — especially behind a new cash-pay launch.'],
    objections: [
      'I\'m a doctor, not a marketer.',
      'Health-claim and device compliance (FDA/FTC for laser/Zerona).',
      'Skepticism from past ad spend that didn\'t convert.',
    ],
    what_tried: 'Expensive ad agencies and "done-for-you" packages that produced clicks but not booked patients.',
    vocabulary: ['new patient acquisition', 'reactivation', 'recall', 'ROF (report of findings)', 'PVA (patient visit average)', 'no-shows', 'cash-pay', 'reviews', 'front desk'],
    trust_triggers: ['You understand clinic flow and front-desk reality.', 'You respect health-claim/device compliance.', 'You can point to a real launch you ran (Zerona/White House).'],
    buying_trigger: 'Launching a new cash-pay service with no infrastructure, or watching reactivation and follow-up slip while the schedule has holes.',
    channels: ['Facebook/Instagram', 'local SEO', 'practice-owner groups', 'chiropractic conferences', 'referrals'],
    proof_point: 'The Zerona launch at White House Chiropractic — a real cash-pay service launch you ran.',
    writing_target: 'Write to a clinic owner who\'s a great doctor and a reluctant marketer — show him a system that fills the schedule and follows up automatically so his front desk doesn\'t have to, and that won\'t get him in trouble with the FDA/FTC.',
  },
  {
    name: 'Faith-Based Nonprofit Leader',
    persona: 'The Director. Executive director or founder of a mission-driven nonprofit. Chronically under-resourced, wears every hat, runs on conviction and caffeine.',
    summary: 'Mission-driven, faith-based nonprofit leader; lowest budget — price-frame carefully.',
    pains: [
      'Grant writing eats weeks I don\'t have and I\'m not even sure I\'m doing it right.',
      'Donor communication is inconsistent — I mean to follow up and I don\'t.',
      'Marketing? With what staff?',
      'We\'re leaving funding on the table because I can\'t keep up.',
    ],
    desires: ['Capacity: grant submissions that actually go out, consistent donor communication, and marketing that happens without a hire she can\'t afford.'],
    objections: [
      'Budget is dominant — frame everything around stewardship and ROI, never cost.',
      'Is this aligned with our mission and our values?',
      'Tech overwhelm.',
    ],
    what_tried: 'Doing it all herself, volunteers who come and go, free tools she never has time to learn.',
    vocabulary: ['donors', 'grants', 'mission', 'stewardship', 'impact', 'board', 'capacity', 'development'],
    trust_triggers: ['Shared faith and values — and meaning it, not using it as an angle.', 'Understanding nonprofit constraints.', 'Clear evidence you\'re not just extracting money from a tight budget.'],
    buying_trigger: 'A grant deadline, a hard capacity wall, or a board pushing to "modernize."',
    channels: ['Faith communities', 'nonprofit networks', 'referrals', 'local relationships', 'LinkedIn'],
    proof_point: 'GrantCraft / The Way Maker Place — real grant + capacity work for a faith-based nonprofit.',
    writing_target: 'Write to a mission-driven, under-resourced nonprofit leader who shares your faith and values — show her how to multiply her capacity (grants, donor follow-up, marketing) as good stewardship, framed around impact and never around cost.',
  },
  {
    name: 'Home Services Owner',
    persona: 'The Owner-Operator. HVAC, plumbing, electrical, roofing, landscaping. Field-based, often still in the truck. Built the business on sweat and reputation.',
    summary: 'Field-based home-services owner-operator; wants dead-simple.',
    pains: [
      'Every missed call is money walking out the door.',
      'We\'re too slow getting back to leads.',
      'Quotes go out and we never follow up.',
      'Reviews matter and I have no system for getting them.',
      'Busy season we\'re drowning, slow season we\'re scrambling.',
    ],
    desires: ['Speed to lead, automatic follow-up on every quote, more reviews, and a way to smooth seasonal swings — all dead simple, no babysitting.'],
    objections: [
      'I\'m not a computer guy.',
      'Suspicious of marketing spend after past disappointments.',
      'Wants it simple — if it\'s complicated, it\'s dead on arrival.',
    ],
    what_tried: 'A lead-gen company that sold him garbage leads, or an answering service that didn\'t book jobs.',
    vocabulary: ['jobs', 'tickets', 'dispatch', 'leads', 'quotes/estimates', 'speed to lead', 'reviews', 'busy season', 'calls'],
    trust_triggers: ['You talk like a real person, not a salesperson.', 'You get that every missed call is real money.', 'You deliver something tangible fast.'],
    buying_trigger: 'A busy season he can\'t keep up with, or a slow stretch he needs to fill — both mean "I\'m losing money right now."',
    channels: ['Facebook', 'local search/Google', 'trade groups', 'referrals', 'word of mouth'],
    proof_point: 'SkyTrain-adjacent field/lead-gen work — speed-to-lead and follow-up for field service businesses.',
    writing_target: 'Write to a no-nonsense home services owner who\'s still close to the field — show him how to stop losing money on missed calls and dead quotes with something dead simple that books jobs and runs itself.',
  },
];

/** Idempotent: seeds master (only if unset) and each overlay (only if its name is absent). */
export function seedMarketingAvatars(db: Database.Database): void {
  if (!getMasterProfile(db)) {
    upsertMasterProfile(db, MASTER);
  }
  const existing = new Set(
    (db.prepare('SELECT name FROM avatars').all() as { name: string }[]).map((r) => r.name)
  );
  for (const overlay of OVERLAYS) {
    if (!existing.has(overlay.name)) createAvatar(db, overlay);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/seed/marketing-avatars.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Call the seed from `getDb` (production path only)**

In `src/lib/db.ts`, add the import at the top (near other imports):

```ts
import { seedMarketingAvatars } from '@/lib/seed/marketing-avatars';
```

Then change `getDb` to seed once after init:

```ts
export function getDb(): Database.Database {
  if (!_db) {
    _db = initDb();
    seedMarketingAvatars(_db);
  }
  return _db;
}
```

- [ ] **Step 6: Verify the full suite still builds/passes**

Run: `npx vitest run`
Expected: PASS (all existing + new tests).

- [ ] **Step 7: Commit**

```bash
git add src/lib/seed/marketing-avatars.ts tests/seed/marketing-avatars.test.ts src/lib/db.ts
git commit -m "feat(avatars): idempotent seed of Master + 4 overlays"
```

---

## Task 7: `/api/master` route

**Files:**
- Create: `src/app/api/master/route.ts`

- [ ] **Step 1: Implement the route**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getMasterProfile, upsertMasterProfile } from '@/lib/queries/master-queries';
import type { MasterObjection } from '@/lib/types';

export async function GET() {
  const db = getDb();
  return NextResponse.json({ master: getMasterProfile(db) });
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const strArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
  const objections: MasterObjection[] = Array.isArray(body?.objections)
    ? body.objections
        .filter((o: unknown) => o && typeof (o as { objection?: unknown }).objection === 'string')
        .map((o: { objection: string; counter?: string }) => ({
          objection: String(o.objection).trim(),
          counter: String(o.counter ?? '').trim(),
        }))
        .filter((o: MasterObjection) => o.objection)
    : [];

  const db = getDb();
  upsertMasterProfile(db, {
    identity: str(body?.identity),
    wants: str(body?.wants),
    burned_by: str(body?.burned_by),
    buying_trigger: str(body?.buying_trigger),
    tone: str(body?.tone),
    objections,
    trust_builders: strArray(body?.trust_builders),
  });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors in `src/app/api/master/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/master/route.ts
git commit -m "feat(avatars): /api/master GET+PUT"
```

---

## Task 8: Extend `/api/avatars` routes to accept structured fields

**Files:**
- Modify: `src/app/api/avatars/route.ts` (POST)
- Modify: `src/app/api/avatars/[id]/route.ts` (PUT)

- [ ] **Step 1: Add a shared body-parser and use it in POST**

In `src/app/api/avatars/route.ts`, replace the `POST` body-building with the full field set. Add this helper above `POST` and use it:

```ts
function parseAvatarBody(body: Record<string, unknown> | null) {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
  return {
    summary: str(body?.summary),
    description: str(body?.description),
    tone: str(body?.tone),
    is_active: body?.is_active !== false,
    persona: str(body?.persona),
    buying_trigger: str(body?.buying_trigger),
    proof_point: str(body?.proof_point),
    writing_target: str(body?.writing_target),
    what_tried: str(body?.what_tried),
    pains: arr(body?.pains),
    desires: arr(body?.desires),
    objections: arr(body?.objections),
    vocabulary: arr(body?.vocabulary),
    trust_triggers: arr(body?.trust_triggers),
    channels: arr(body?.channels),
  };
}
```

Then the `POST` body becomes:

```ts
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const db = getDb();
  const id = createAvatar(db, { name, ...parseAvatarBody(body) });
  return NextResponse.json({ id });
}
```

- [ ] **Step 2: Mirror in PUT**

In `src/app/api/avatars/[id]/route.ts`, copy the same `parseAvatarBody` helper (repeat it — routes are read independently) and change the `updateAvatar` call:

```ts
  updateAvatar(db, Number(id), { name, ...parseAvatarBody(body) });
```

(Keep the existing name validation and the 404 check above it unchanged.)

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors in either route file.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/avatars/route.ts "src/app/api/avatars/[id]/route.ts"
git commit -m "feat(avatars): API accepts structured overlay fields"
```

---

## Task 9: Wire `/api/generate` to composeAudience

**Files:**
- Modify: `src/app/api/generate/route.ts`

- [ ] **Step 1: Swap imports and audience resolution**

Change the imports:

```ts
import { getAvatar, listAvatars } from '@/lib/queries/avatar-queries';
import { composeAudience } from '@/lib/generation/audience';
import { getMasterProfile } from '@/lib/queries/master-queries';
```

(Remove the old `avatarToAudience, blendedAudience` import.)

Replace the audience-resolution block with:

```ts
  // Resolve audience: master is ALWAYS applied; pick one vertical, 'all' (generic), or none (master only).
  const master = getMasterProfile(db);
  const avatarParam = body?.avatar; // number | 'all' | null
  let audience: string | undefined;
  let avatarId: number | null = null;
  if (avatarParam === 'all') {
    audience = composeAudience(master, null, { allVerticals: listAvatars(db, true) }) || undefined;
  } else if (Number.isFinite(Number(avatarParam))) {
    const avatar = getAvatar(db, Number(avatarParam));
    if (avatar) { audience = composeAudience(master, avatar) || undefined; avatarId = avatar.id; }
    else { audience = composeAudience(master, null) || undefined; }
  } else {
    audience = composeAudience(master, null) || undefined; // master only / general
  }
```

(Leave the rest of the handler — `retrieveContext`, `generateContent`, `createGeneration` — unchanged.)

- [ ] **Step 2: Verify it compiles and the suite passes**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/generate/route.ts
git commit -m "feat(generate): master-always + one-vertical audience composition"
```

---

## Task 10: Master Profile editor component

**Files:**
- Create: `src/components/master-profile-editor.tsx`

- [ ] **Step 1: Implement the editor**

A client component that loads via the `initialMaster` prop and PUTs to `/api/master`. Array fields use one-item-per-line textareas; objections use paired "objection / counter" rows joined as `objection :: counter` per line for simplicity.

```tsx
'use client';

import { useState } from 'react';
import type { MasterProfile, MasterObjection } from '@/lib/types';

function linesToArray(s: string): string[] {
  return s.split('\n').map((x) => x.trim()).filter(Boolean);
}
function arrayToLines(a: string[]): string { return a.join('\n'); }
function objectionsToText(o: MasterObjection[]): string {
  return o.map((x) => `${x.objection} :: ${x.counter}`).join('\n');
}
function textToObjections(s: string): MasterObjection[] {
  return linesToArray(s).map((line) => {
    const [objection, counter = ''] = line.split('::').map((p) => p.trim());
    return { objection, counter };
  }).filter((o) => o.objection);
}

export function MasterProfileEditor({ initialMaster }: { initialMaster: MasterProfile | null }) {
  const [identity, setIdentity] = useState(initialMaster?.identity ?? '');
  const [wants, setWants] = useState(initialMaster?.wants ?? '');
  const [burnedBy, setBurnedBy] = useState(initialMaster?.burned_by ?? '');
  const [buyingTrigger, setBuyingTrigger] = useState(initialMaster?.buying_trigger ?? '');
  const [tone, setTone] = useState(initialMaster?.tone ?? '');
  const [trustBuilders, setTrustBuilders] = useState(arrayToLines(initialMaster?.trust_builders ?? []));
  const [objections, setObjections] = useState(objectionsToText(initialMaster?.objections ?? []));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true); setSaved(false);
    try {
      const res = await fetch('/api/master', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identity, wants, burned_by: burnedBy, buying_trigger: buyingTrigger, tone,
          trust_builders: linesToArray(trustBuilders),
          objections: textToObjections(objections),
        }),
      });
      if (res.ok) setSaved(true);
    } finally { setBusy(false); }
  }

  const ta = 'w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-pink-500 focus:outline-none';
  const lbl = 'block text-xs text-gray-400 mb-1';

  return (
    <div className="bg-gray-900 border border-pink-600/40 rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Master Profile — “The Owner Who Built It”</h3>
        <span className="text-xs text-gray-500">Always applied to every piece</span>
      </div>
      <div><label className={lbl}>Core identity</label>
        <textarea className={ta} rows={3} value={identity} onChange={(e) => setIdentity(e.target.value)} /></div>
      <div><label className={lbl}>What they actually want</label>
        <textarea className={ta} rows={2} value={wants} onChange={(e) => setWants(e.target.value)} /></div>
      <div><label className={lbl}>How they’ve been burned</label>
        <textarea className={ta} rows={2} value={burnedBy} onChange={(e) => setBurnedBy(e.target.value)} /></div>
      <div><label className={lbl}>Universal buying trigger</label>
        <textarea className={ta} rows={2} value={buyingTrigger} onChange={(e) => setBuyingTrigger(e.target.value)} /></div>
      <div><label className={lbl}>Tone for all content</label>
        <textarea className={ta} rows={2} value={tone} onChange={(e) => setTone(e.target.value)} /></div>
      <div><label className={lbl}>What earns their trust — one per line</label>
        <textarea className={ta} rows={4} value={trustBuilders} onChange={(e) => setTrustBuilders(e.target.value)} /></div>
      <div><label className={lbl}>Universal objections — one per line, format: <code>objection :: counter</code></label>
        <textarea className={ta} rows={6} value={objections} onChange={(e) => setObjections(e.target.value)} /></div>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy}
          className="px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
          {busy ? 'Saving…' : 'Save Master Profile'}
        </button>
        {saved && <span className="text-xs text-green-400">Saved</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/master-profile-editor.tsx
git commit -m "feat(avatars): Master Profile editor component"
```

---

## Task 11: Structured-field editor in AvatarManager

**Files:**
- Modify: `src/components/avatar-manager.tsx`

- [ ] **Step 1: Extend the Draft model + EMPTY**

Replace the `EMPTY`/`Draft` definitions (lines 6-7) with:

```tsx
const EMPTY = {
  name: '', summary: '', description: '', tone: '', is_active: true,
  persona: '', buying_trigger: '', proof_point: '', writing_target: '', what_tried: '',
  pains: '', desires: '', objections: '', vocabulary: '', trust_triggers: '', channels: '',
};
type Draft = typeof EMPTY;

const linesToArray = (s: string): string[] => s.split('\n').map((x) => x.trim()).filter(Boolean);
const arrayToLines = (a: string[]): string => a.join('\n');
```

- [ ] **Step 2: Populate the draft from an avatar in `startEdit`**

Replace `startEdit` (lines 21-24) with:

```tsx
  function startEdit(a: Avatar) {
    setEditingId(a.id);
    setDraft({
      name: a.name, summary: a.summary ?? '', description: a.description ?? '', tone: a.tone ?? '', is_active: !!a.is_active,
      persona: a.persona ?? '', buying_trigger: a.buying_trigger ?? '', proof_point: a.proof_point ?? '',
      writing_target: a.writing_target ?? '', what_tried: a.what_tried ?? '',
      pains: arrayToLines(a.pains), desires: arrayToLines(a.desires), objections: arrayToLines(a.objections),
      vocabulary: arrayToLines(a.vocabulary), trust_triggers: arrayToLines(a.trust_triggers), channels: arrayToLines(a.channels),
    });
  }
```

- [ ] **Step 3: Serialize arrays in `save`**

In `save` (lines 27-39), replace the `body: JSON.stringify(draft)` line with an explicit payload:

```tsx
        body: JSON.stringify({
          name: draft.name, summary: draft.summary, description: draft.description, tone: draft.tone, is_active: draft.is_active,
          persona: draft.persona, buying_trigger: draft.buying_trigger, proof_point: draft.proof_point,
          writing_target: draft.writing_target, what_tried: draft.what_tried,
          pains: linesToArray(draft.pains), desires: linesToArray(draft.desires), objections: linesToArray(draft.objections),
          vocabulary: linesToArray(draft.vocabulary), trust_triggers: linesToArray(draft.trust_triggers), channels: linesToArray(draft.channels),
        }),
```

- [ ] **Step 4: Add the new fields to the editor form**

Inside the editor `<div>` (after the existing Tone `Field`, before the `is_active` checkbox at line 80), add the structured fields. Reuse the existing `Field` helper:

```tsx
          <Field label="Persona" hint="e.g. David, the Fiduciary">
            <input value={draft.persona} onChange={(e) => setDraft({ ...draft, persona: e.target.value })}
              className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-pink-500 focus:outline-none" />
          </Field>
          <Field label="Pains" hint="in their words — one per line">
            <textarea value={draft.pains} onChange={(e) => setDraft({ ...draft, pains: e.target.value })} rows={4}
              className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-pink-500 focus:outline-none" />
          </Field>
          <Field label="Desired outcomes" hint="one per line">
            <textarea value={draft.desires} onChange={(e) => setDraft({ ...draft, desires: e.target.value })} rows={2}
              className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-pink-500 focus:outline-none" />
          </Field>
          <Field label="Vertical-specific objections" hint="one per line">
            <textarea value={draft.objections} onChange={(e) => setDraft({ ...draft, objections: e.target.value })} rows={3}
              className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-pink-500 focus:outline-none" />
          </Field>
          <Field label="Vocabulary" hint="words/phrases — one per line">
            <textarea value={draft.vocabulary} onChange={(e) => setDraft({ ...draft, vocabulary: e.target.value })} rows={3}
              className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-pink-500 focus:outline-none" />
          </Field>
          <Field label="Trust triggers" hint="one per line">
            <textarea value={draft.trust_triggers} onChange={(e) => setDraft({ ...draft, trust_triggers: e.target.value })} rows={3}
              className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-pink-500 focus:outline-none" />
          </Field>
          <Field label="Channels" hint="one per line">
            <textarea value={draft.channels} onChange={(e) => setDraft({ ...draft, channels: e.target.value })} rows={2}
              className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-pink-500 focus:outline-none" />
          </Field>
          <Field label="Buying trigger">
            <input value={draft.buying_trigger} onChange={(e) => setDraft({ ...draft, buying_trigger: e.target.value })}
              className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-pink-500 focus:outline-none" />
          </Field>
          <Field label="What they’ve tried">
            <textarea value={draft.what_tried} onChange={(e) => setDraft({ ...draft, what_tried: e.target.value })} rows={2}
              className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-pink-500 focus:outline-none" />
          </Field>
          <Field label="Proof point" hint="real credibility to inject">
            <input value={draft.proof_point} onChange={(e) => setDraft({ ...draft, proof_point: e.target.value })}
              className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-pink-500 focus:outline-none" />
          </Field>
          <Field label="Writing target" hint="the one-sentence anchor instruction">
            <textarea value={draft.writing_target} onChange={(e) => setDraft({ ...draft, writing_target: e.target.value })} rows={3}
              className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-pink-500 focus:outline-none" />
          </Field>
```

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/avatar-manager.tsx
git commit -m "feat(avatars): structured-field editor for vertical overlays"
```

---

## Task 12: Render Master + verticals on the Avatars page

**Files:**
- Modify: `src/app/(dashboard)/avatars/page.tsx`

- [ ] **Step 1: Load the master and render the editor above the list**

```tsx
import { getDb } from '@/lib/db';
import { listAvatars } from '@/lib/queries/avatar-queries';
import { getMasterProfile } from '@/lib/queries/master-queries';
import { AvatarManager } from '@/components/avatar-manager';
import { MasterProfileEditor } from '@/components/master-profile-editor';

export const dynamic = 'force-dynamic';

export default async function AvatarsPage() {
  const db = getDb();
  const avatars = listAvatars(db);
  const master = getMasterProfile(db);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-start gap-3 mb-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pink-600 text-xl">👥</div>
        <div>
          <h2 className="text-2xl font-bold">Avatars</h2>
          <p className="text-sm text-gray-400">Master profile (always applied) + one vertical overlay per piece</p>
        </div>
      </div>

      <div className="max-w-3xl space-y-6">
        <MasterProfileEditor initialMaster={master} />
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Vertical overlays</h3>
          <AvatarManager initialAvatars={avatars} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/avatars/page.tsx"
git commit -m "feat(avatars): render Master Profile editor above overlays"
```

---

## Task 13: Generate picker — master note + "All verticals ⚠ generic"

**Files:**
- Modify: `src/components/generate-studio.tsx` (audience selector ~lines 152-163)

- [ ] **Step 1: Update the selector labels**

Change the option labels and add a master note. Replace the selector block:

```tsx
                <span className="text-xs text-gray-500">Audience:</span>
                <span className="text-[11px] text-pink-400/80 mr-1">Master Profile: always applied</span>
                <select
                  value={String(avatarSel)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setAvatarSel(v === 'none' || v === 'all' ? v : Number(v));
                  }}
                  className="rounded-lg bg-gray-950 border border-gray-700 px-2 py-1 text-xs text-white focus:border-pink-500 focus:outline-none"
                >
                  <option value="none">Master only (no vertical)</option>
                  {avatars.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  {avatars.length >= 2 && <option value="all">All verticals ⚠ generic</option>}
                </select>
```

(If the existing `onChange` already coerces the value, keep whichever form compiles — the key changes are the three option labels and the master note.)

- [ ] **Step 2: Verify it compiles + suite passes**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no errors; all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/generate-studio.tsx
git commit -m "feat(generate): master-always note + All verticals generic label"
```

---

## Task 14: Final verification + deploy notes

- [ ] **Step 1: Full test suite + production build**

Run: `npx vitest run && npm run build`
Expected: all tests PASS; build succeeds (watch for the OOM gotcha only on the server, not locally).

- [ ] **Step 2: Manual smoke (local dev)**

Run: `npm run dev`, then:
- Visit `/avatars` — Master Profile editor shows seeded values (after first `getDb()` in dev seeds the local DB); 4 overlays + any legacy avatars listed; edit an overlay and confirm structured fields save.
- Visit `/generate` — audience selector shows "Master Profile: always applied", "Master only", each vertical, and "All verticals ⚠ generic". Generate once with a vertical selected and confirm output respects vocabulary + proof.

- [ ] **Step 3: Deploy**

Standard deploy (no new deps):
```bash
ssh root@143.244.169.43 "cd /var/www/commandpost && git checkout -- package-lock.json 2>/dev/null; git pull origin main && npm run build && pm2 restart commandpost"
```
The additive migration runs on first `getDb()` after restart; seeding inserts Master + 4 overlays once. No cold `.next` wipe needed.

---

## Self-Review Notes (author)

- **Spec coverage:** structured data model (Tasks 1-4), composition logic incl. content rules for all content types (Task 5), seeding keep-old (Task 6), `/api/master` + avatar API (Tasks 7-8), Generate master-always + "All verticals" warned (Tasks 9, 13), UI master + overlays (Tasks 10-12). All spec sections map to a task.
- **Type consistency:** `composeAudience(master, vertical, opts?)`, `getMasterProfile`/`upsertMasterProfile`, `seedMarketingAvatars`, extended `AvatarInput` — names used identically across tasks.
- **No placeholders:** every code step shows full code; seed data is verbatim, not "TODO fill in."
