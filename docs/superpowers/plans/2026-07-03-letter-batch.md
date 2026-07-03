# Handwritten Letter Batch Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every day, email Caroline Smith one batch of up to 10 handwritten-letter assignments (letter text + recipient name + envelope address) for companies that entered the email outreach queue, and mark them so they never repeat.

**Architecture:** Mirrors the existing email queue: three new `letter_*` columns on `leads`, a queries module for eligibility/marking, an orchestrator (`runLetterBatchTick`) that drafts missing letters via the existing `generateDraft`, composes one plain-text email, and sends it through the existing Gmail service-account `Transport`. A secret-protected `POST /api/outreach/letter-batch-tick` endpoint is fired by a daily crontab entry. A `letter_batch_enabled` app-setting gates real sends; `{ dryRun: true, to: "..." }` sends a format-test email without mutating anything.

**Tech Stack:** Next.js 16 App Router route handlers, better-sqlite3, vitest, Gmail API via `google-auth-library` JWT (already wrapped in `buildTransport()`).

**Spec:** `docs/superpowers/specs/2026-07-03-letter-batch-design.md`

## Global Constraints

- The new sent-timestamp column MUST be `letter_sent_at_q`, never `letter_sent_at` — `letter_sent_at` is already a derived alias in `src/lib/queries/outreach-lead-queries.ts:62` (built from `outreach_touches`).
- Default batch recipient: `thecarolinem@icloud.com` (Caroline Smith). Test recipient: `philsmith4321@gmail.com`.
- Batch size 10; partial batches OK; zero eligible → send nothing.
- Return address shown in every batch email: `Phil Smith` / `1004 Thistle Court, Hendersonville, TN 37075` (import `MAILING_ADDRESS` from `@/lib/outreach/draft`, do not re-type it).
- Real (non-dry-run) sends require app_setting `letter_batch_enabled = '1'` and at most one batch per Central-time date (`letter_last_batch_date` guard).
- Nothing is marked sent unless the Gmail send succeeded AND it was not a dry run.
- This is Next.js 16 — per AGENTS.md, if a route-handler API looks unfamiliar, check `node_modules/next/dist/docs/`. The new route copies `src/app/api/outreach/send-tick/route.ts` verbatim in structure, which is known-good.
- Tests: vitest, in-memory `better-sqlite3` databases with hand-built minimal schemas (pattern: `tests/queries/sequence-queries.test.ts`). Run with `npx vitest run <file>`.
- Commit after each task.

---

### Task 1: DB migration — letter queue columns

**Files:**
- Modify: `src/lib/db.ts` (insert a new migration block immediately after the 5-email drip sequence migration block that ends with the `idx_sequence_sends_lead` index creation, around line 945–949)
- Test: `tests/letter-batch-migration.test.ts`

**Interfaces:**
- Produces: `leads` columns `letter_status TEXT`, `letter_sent_at_q TEXT`, `letter_batch_date TEXT` (all nullable), available to every later task.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/letter-batch-migration.test.ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { initDb } from '@/lib/db';

describe('letter batch migration', () => {
  it('adds letter_status, letter_sent_at_q, letter_batch_date to leads', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'cp-letter-mig-'));
    const db = initDb(path.join(dir, 'test.db'));
    const cols = new Set(
      (db.prepare('PRAGMA table_info(leads)').all() as { name: string }[]).map((c) => c.name)
    );
    expect(cols.has('letter_status')).toBe(true);
    expect(cols.has('letter_sent_at_q')).toBe(true);
    expect(cols.has('letter_batch_date')).toBe(true);
    db.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/letter-batch-migration.test.ts`
Expected: FAIL — `expect(cols.has('letter_status')).toBe(true)` receives `false`.

- [ ] **Step 3: Write the migration**

In `src/lib/db.ts`, directly after the drip-sequence migration block (the `{ ... }` block that creates `sequence_sends` and `idx_sequence_sends_lead`), insert:

```typescript
  // Migration: handwritten-letter batch queue — parallels the email queue's
  // per-lead status columns. letter_sent_at_q (not letter_sent_at) because
  // listLeadsByLane already derives a letter_sent_at alias from
  // outreach_touches; same collision email_sent_at_q solved.
  {
    const have = new Set(
      (db.prepare("PRAGMA table_info(leads)").all() as { name: string }[]).map((c) => c.name)
    );
    const add: Array<[string, string]> = [
      ['letter_status', 'TEXT'],
      ['letter_sent_at_q', 'TEXT'],
      ['letter_batch_date', 'TEXT'],
    ];
    for (const [name, decl] of add) {
      if (!have.has(name)) db.exec(`ALTER TABLE leads ADD COLUMN ${name} ${decl}`);
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/letter-batch-migration.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full suite to check for regressions**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db.ts tests/letter-batch-migration.test.ts
git commit -m "feat: add letter batch queue columns to leads"
```

---

### Task 2: Letter batch queries — eligibility, draft save, batch marking

**Files:**
- Create: `src/lib/queries/letter-batch-queries.ts`
- Test: `tests/queries/letter-batch-queries.test.ts`

**Interfaces:**
- Consumes: Task 1's columns.
- Produces:
  - `interface LetterLead { id: number; business_name: string | null; contact_person: string | null; street: string | null; city: string | null; state: string | null; postal_code: string | null; draft_letter: string | null; email_queued_at: string | null; lane: string | null; segment: string | null; category: string | null; employee_min: number | null; employee_max: number | null; website: string | null; }`
  - `eligibleLetterLeads(db: Database.Database, limit: number): LetterLead[]`
  - `saveLetterDraft(db: Database.Database, id: number, text: string): void`
  - `markLetterBatchSent(db: Database.Database, ids: number[], batchDate: string): void`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/queries/letter-batch-queries.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  eligibleLetterLeads, saveLetterDraft, markLetterBatchSent,
} from '@/lib/queries/letter-batch-queries';

function freshDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE leads (
      id INTEGER PRIMARY KEY, business_name TEXT, contact_person TEXT,
      street TEXT, city TEXT, state TEXT, postal_code TEXT,
      lane TEXT, segment TEXT, category TEXT,
      employee_min INTEGER, employee_max INTEGER, website TEXT,
      email_status TEXT, email_queued_at TEXT,
      do_not_email INTEGER NOT NULL DEFAULT 0,
      draft_letter TEXT, letter_status TEXT, letter_sent_at_q TEXT,
      letter_batch_date TEXT, updated_at TEXT
    );
    CREATE TABLE outreach_touches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      channel TEXT NOT NULL CHECK(channel IN ('letter','email','phone','linkedin','fb')),
      sent_at TEXT NOT NULL DEFAULT (datetime('now')),
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const ins = db.prepare(`INSERT INTO leads
    (business_name, contact_person, street, city, state, postal_code, email_status, email_queued_at, do_not_email, letter_status)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);
  // 1: queued, complete address — eligible
  ins.run('Acme HVAC', 'Brett Boston', '12 Main St', 'Hendersonville', 'TN', '37075', 'queued', '2026-06-01 10:00:00', 0, null);
  // 2: email already sent (was queued) — still eligible, queued LATER than #1
  ins.run('Beta Roofing', null, '9 Oak Ave', 'Gallatin', 'TN', '37066', 'sent', '2026-06-02 10:00:00', 0, null);
  // 3: complete but never entered the email queue — NOT eligible
  ins.run('Gamma Law', 'Ann Lee', '4 Elm St', 'Nashville', 'TN', '37201', 'draft', null, 0, null);
  // 4: queued but missing street — NOT eligible
  ins.run('Delta Dental', 'Joe Ray', null, 'Franklin', 'TN', '37064', 'queued', '2026-06-03 10:00:00', 0, null);
  // 5: queued, complete, but do_not_email — NOT eligible
  ins.run('Epsilon Gym', 'Kim Fox', '7 Pine Rd', 'Lebanon', 'TN', '37087', 'queued', '2026-06-04 10:00:00', 1, null);
  // 6: queued, complete, but letter already sent — NOT eligible
  ins.run('Zeta Cafe', 'Lou Poe', '3 Ash Ln', 'Smyrna', 'TN', '37167', 'queued', '2026-06-05 10:00:00', 0, 'sent');
  // 7: queued but blank business name — NOT eligible
  ins.run('  ', 'Max Orr', '8 Fir Ct', 'Hermitage', 'TN', '37076', 'queued', '2026-06-06 10:00:00', 0, null);
  return db;
}

describe('eligibleLetterLeads', () => {
  let db: Database.Database;
  beforeEach(() => { db = freshDb(); });

  it('returns only queue-entered, mailable, unlettered leads, oldest-queued first', () => {
    expect(eligibleLetterLeads(db, 10).map((l) => l.id)).toEqual([1, 2]);
  });

  it('honors the limit', () => {
    expect(eligibleLetterLeads(db, 1).map((l) => l.id)).toEqual([1]);
  });
});

describe('saveLetterDraft', () => {
  it('stores the draft text', () => {
    const db = freshDb();
    saveLetterDraft(db, 1, 'Dear Brett...');
    expect(eligibleLetterLeads(db, 10)[0].draft_letter).toBe('Dear Brett...');
  });
});

describe('markLetterBatchSent', () => {
  it('stamps status/date and logs a letter touch per lead, removing them from the pool', () => {
    const db = freshDb();
    markLetterBatchSent(db, [1, 2], '2026-07-03');
    expect(eligibleLetterLeads(db, 10)).toEqual([]);
    const row = db.prepare('SELECT letter_status, letter_sent_at_q, letter_batch_date FROM leads WHERE id=1')
      .get() as { letter_status: string; letter_sent_at_q: string; letter_batch_date: string };
    expect(row.letter_status).toBe('sent');
    expect(row.letter_sent_at_q).toBeTruthy();
    expect(row.letter_batch_date).toBe('2026-07-03');
    const touches = db.prepare("SELECT lead_id FROM outreach_touches WHERE channel='letter' ORDER BY lead_id")
      .all() as { lead_id: number }[];
    expect(touches.map((t) => t.lead_id)).toEqual([1, 2]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/queries/letter-batch-queries.test.ts`
Expected: FAIL — cannot resolve `@/lib/queries/letter-batch-queries`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/queries/letter-batch-queries.ts
import type Database from 'better-sqlite3';

// Everything the letter batch needs per lead: envelope address fields plus the
// personalization fields generateDraft reads (lane, segment, size, website).
export interface LetterLead {
  id: number; business_name: string | null; contact_person: string | null;
  street: string | null; city: string | null; state: string | null; postal_code: string | null;
  draft_letter: string | null; email_queued_at: string | null;
  lane: string | null; segment: string | null; category: string | null;
  employee_min: number | null; employee_max: number | null; website: string | null;
}

const SELECT = `SELECT id, business_name, contact_person, street, city, state, postal_code,
  draft_letter, email_queued_at, lane, segment, category, employee_min, employee_max, website FROM leads`;

// A lead earns a handwritten letter once it has entered the email queue
// (queued now OR already auto-emailed — leads keep their spot after the email
// sends) and has a business name plus a complete mailing address.
export function eligibleLetterLeads(db: Database.Database, limit: number): LetterLead[] {
  return db.prepare(`${SELECT}
    WHERE email_status IN ('queued','sent') AND email_queued_at IS NOT NULL
      AND letter_status IS NULL
      AND COALESCE(do_not_email, 0) = 0
      AND business_name IS NOT NULL AND trim(business_name) <> ''
      AND street IS NOT NULL AND trim(street) <> ''
      AND city IS NOT NULL AND trim(city) <> ''
      AND state IS NOT NULL AND trim(state) <> ''
      AND postal_code IS NOT NULL AND trim(postal_code) <> ''
    ORDER BY email_queued_at, id LIMIT ?`).all(limit) as LetterLead[];
}

export function saveLetterDraft(db: Database.Database, id: number, text: string): void {
  db.prepare(`UPDATE leads SET draft_letter=?, updated_at=datetime('now') WHERE id=?`).run(text, id);
}

// Stamp every lead in a shipped batch and log a letter touch each, atomically.
export function markLetterBatchSent(db: Database.Database, ids: number[], batchDate: string): void {
  const stamp = db.prepare(`UPDATE leads SET letter_status='sent', letter_sent_at_q=datetime('now'),
    letter_batch_date=?, updated_at=datetime('now') WHERE id=?`);
  const touch = db.prepare(
    "INSERT INTO outreach_touches (lead_id, channel, note) VALUES (?, 'letter', 'batched to Caroline')"
  );
  db.transaction(() => {
    for (const id of ids) { stamp.run(batchDate, id); touch.run(id); }
  })();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/queries/letter-batch-queries.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/letter-batch-queries.ts tests/queries/letter-batch-queries.test.ts
git commit -m "feat: letter batch eligibility and marking queries"
```

---

### Task 3: Batch email composition

**Files:**
- Create: `src/lib/outreach/letter-batch.ts`
- Test: `tests/letter-batch.test.ts`

**Interfaces:**
- Consumes: `LetterLead` from Task 2; `MAILING_ADDRESS` from `@/lib/outreach/draft`.
- Produces (all exported from `src/lib/outreach/letter-batch.ts`):
  - `LETTER_BATCH_SIZE = 10`, `LETTER_BATCH_ENABLED_KEY = 'letter_batch_enabled'`, `LETTER_BATCH_RECIPIENT_KEY = 'letter_batch_recipient'`, `LETTER_LAST_BATCH_DATE_KEY = 'letter_last_batch_date'`, `DEFAULT_LETTER_RECIPIENT = 'thecarolinem@icloud.com'`
  - `recipientName(lead: LetterLead): string`
  - `formatEnvelope(lead: LetterLead): string`
  - `centralDateParts(now: Date): { isoDate: string; label: string }`
  - `composeLetterBatchEmail(leads: LetterLead[], dateLabel: string): { subject: string; text: string }`

- [ ] **Step 1: Write the failing tests**

Create `tests/letter-batch.test.ts` with (Task 4 appends to this same file):

```typescript
// tests/letter-batch.test.ts
import { describe, it, expect } from 'vitest';
import type { LetterLead } from '@/lib/queries/letter-batch-queries';
import {
  recipientName, formatEnvelope, centralDateParts, composeLetterBatchEmail,
} from '@/lib/outreach/letter-batch';

function lead(over: Partial<LetterLead> = {}): LetterLead {
  return {
    id: 1, business_name: 'Acme HVAC', contact_person: 'Brett Boston',
    street: '12 Main St', city: 'Hendersonville', state: 'TN', postal_code: '37075',
    draft_letter: 'Hi Brett, short letter body.', email_queued_at: '2026-06-01 10:00:00',
    lane: null, segment: null, category: null, employee_min: null, employee_max: null, website: null,
    ...over,
  };
}

describe('recipientName', () => {
  it('uses contact_person, falling back to business name', () => {
    expect(recipientName(lead())).toBe('Brett Boston');
    expect(recipientName(lead({ contact_person: null }))).toBe('Acme HVAC');
    expect(recipientName(lead({ contact_person: '  ' }))).toBe('Acme HVAC');
  });
});

describe('formatEnvelope', () => {
  it('renders name, business, street, city-state-zip', () => {
    expect(formatEnvelope(lead())).toBe('Brett Boston\nAcme HVAC\n12 Main St\nHendersonville, TN 37075');
  });
  it('does not repeat the business name when it is the recipient', () => {
    expect(formatEnvelope(lead({ contact_person: null })))
      .toBe('Acme HVAC\n12 Main St\nHendersonville, TN 37075');
  });
});

describe('centralDateParts', () => {
  it('returns the Central-time ISO date and a human label', () => {
    // 2026-07-03 03:00 UTC is still 2026-07-02 in Chicago (CDT, UTC-5)
    const parts = centralDateParts(new Date('2026-07-03T03:00:00Z'));
    expect(parts.isoDate).toBe('2026-07-02');
    expect(parts.label).toBe('July 2');
  });
});

describe('composeLetterBatchEmail', () => {
  it('numbers each company with envelope + letter text and counts them in the subject', () => {
    const leads = [lead(), lead({ id: 2, business_name: 'Beta Roofing', contact_person: null, draft_letter: 'Hi there, second letter.' })];
    const { subject, text } = composeLetterBatchEmail(leads, 'July 3');
    expect(subject).toBe('Handwritten letters — July 3 (2 companies)');
    expect(text).toContain('LETTER 1 of 2 — Acme HVAC');
    expect(text).toContain('LETTER 2 of 2 — Beta Roofing');
    expect(text).toContain('Brett Boston\nAcme HVAC\n12 Main St\nHendersonville, TN 37075');
    expect(text).toContain('Hi Brett, short letter body.');
    expect(text).toContain('1004 Thistle Court, Hendersonville, TN 37075'); // return address
  });
  it('uses singular "company" for a batch of one', () => {
    expect(composeLetterBatchEmail([lead()], 'July 3').subject)
      .toBe('Handwritten letters — July 3 (1 company)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/letter-batch.test.ts`
Expected: FAIL — cannot resolve `@/lib/outreach/letter-batch`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/outreach/letter-batch.ts
import type { LetterLead } from '@/lib/queries/letter-batch-queries';
import { MAILING_ADDRESS } from '@/lib/outreach/draft';

export const LETTER_BATCH_SIZE = 10;
export const LETTER_BATCH_ENABLED_KEY = 'letter_batch_enabled';
export const LETTER_BATCH_RECIPIENT_KEY = 'letter_batch_recipient';
export const LETTER_LAST_BATCH_DATE_KEY = 'letter_last_batch_date';
export const DEFAULT_LETTER_RECIPIENT = 'thecarolinem@icloud.com';

// Envelope recipient: the contact person when we have one, else the business.
// Eligibility guarantees business_name is non-empty.
export function recipientName(lead: LetterLead): string {
  return lead.contact_person?.trim() || (lead.business_name ?? '').trim();
}

export function formatEnvelope(lead: LetterLead): string {
  const name = recipientName(lead);
  const business = (lead.business_name ?? '').trim();
  const lines = [name];
  if (business && business !== name) lines.push(business);
  lines.push((lead.street ?? '').trim());
  lines.push(`${(lead.city ?? '').trim()}, ${(lead.state ?? '').trim()} ${(lead.postal_code ?? '').trim()}`);
  return lines.join('\n');
}

const TZ = 'America/Chicago';

// Central-time calendar date for "one batch per day" bookkeeping (isoDate,
// YYYY-MM-DD via en-CA) plus a human label ("July 3") for the subject line.
export function centralDateParts(now: Date): { isoDate: string; label: string } {
  const isoDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  const label = new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'long', day: 'numeric' }).format(now);
  return { isoDate, label };
}

const DIVIDER = '='.repeat(50);

export function composeLetterBatchEmail(
  leads: LetterLead[], dateLabel: string
): { subject: string; text: string } {
  const n = leads.length;
  const subject = `Handwritten letters — ${dateLabel} (${n} ${n === 1 ? 'company' : 'companies'})`;
  const sections = leads.map((lead, i) => [
    DIVIDER,
    `LETTER ${i + 1} of ${n} — ${(lead.business_name ?? '').trim()}`,
    DIVIDER,
    '',
    `WRITE TO: ${recipientName(lead)}`,
    '',
    'ENVELOPE ADDRESS:',
    formatEnvelope(lead),
    '',
    'LETTER TEXT:',
    (lead.draft_letter ?? '').trim(),
    '',
  ].join('\n'));
  const text = [
    'Hi Caroline!',
    '',
    `Here ${n === 1 ? 'is' : 'are'} today's ${n} handwritten letter${n === 1 ? '' : 's'}. For each company below you'll find who it goes to, the envelope address, and the letter text to copy by hand.`,
    '',
    'Return address for every envelope:',
    'Phil Smith',
    MAILING_ADDRESS,
    '',
    ...sections,
    'Thank you! — CommandPost (for Dad)',
    '',
  ].join('\n');
  return { subject, text };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/letter-batch.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/outreach/letter-batch.ts tests/letter-batch.test.ts
git commit -m "feat: letter batch email composition"
```

---

### Task 4: The tick orchestrator — `runLetterBatchTick`

**Files:**
- Modify: `src/lib/outreach/letter-batch.ts` (append)
- Test: `tests/letter-batch.test.ts` (append)

**Interfaces:**
- Consumes: Task 2's queries; Task 3's composition; `Transport` interface from `@/lib/email/outreach-sender` (`{ sendMail(mail: { from: string; to: string; subject: string; text: string }): Promise<unknown> }`); `getSetting`/`setSetting` from `@/lib/queries/settings-queries`; `generateDraft(db, lead: OutreachLead, channel)` from `@/lib/outreach/draft`.
- Produces:
  - `interface LetterTickOpts { transport: Transport; now: Date; from: string; dryRun?: boolean; to?: string; draftFn?: (db: Database.Database, lead: LetterLead, channel: 'letter') => Promise<string | null>; }`
  - `interface LetterTickResult { sent: number; skippedDrafts: number; recipient: string | null; dryRun: boolean; leadIds: number[]; reason?: 'disabled' | 'already-sent-today' | 'empty' | 'error'; error?: string; }`
  - `runLetterBatchTick(db: Database.Database, opts: LetterTickOpts): Promise<LetterTickResult>`

- [ ] **Step 1: Write the failing tests**

Append to `tests/letter-batch.test.ts`:

```typescript
import Database from 'better-sqlite3';
import { vi } from 'vitest';
import { runLetterBatchTick, LETTER_BATCH_ENABLED_KEY, LETTER_LAST_BATCH_DATE_KEY, LETTER_BATCH_RECIPIENT_KEY } from '@/lib/outreach/letter-batch';
import { setSetting, getSetting } from '@/lib/queries/settings-queries';

function tickDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE leads (
      id INTEGER PRIMARY KEY, business_name TEXT, contact_person TEXT,
      street TEXT, city TEXT, state TEXT, postal_code TEXT,
      lane TEXT, segment TEXT, category TEXT,
      employee_min INTEGER, employee_max INTEGER, website TEXT,
      email_status TEXT, email_queued_at TEXT,
      do_not_email INTEGER NOT NULL DEFAULT 0,
      draft_letter TEXT, letter_status TEXT, letter_sent_at_q TEXT,
      letter_batch_date TEXT, updated_at TEXT
    );
    CREATE TABLE outreach_touches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      channel TEXT NOT NULL CHECK(channel IN ('letter','email','phone','linkedin','fb')),
      sent_at TEXT NOT NULL DEFAULT (datetime('now')),
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT);
  `);
  const ins = db.prepare(`INSERT INTO leads
    (business_name, contact_person, street, city, state, postal_code, email_status, email_queued_at, draft_letter)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  ins.run('Acme HVAC', 'Brett Boston', '12 Main St', 'Hendersonville', 'TN', '37075', 'queued', '2026-06-01 10:00:00', 'Existing letter draft.');
  ins.run('Beta Roofing', null, '9 Oak Ave', 'Gallatin', 'TN', '37066', 'queued', '2026-06-02 10:00:00', null);
  return db;
}

// 2026-07-03T14:00Z = 9am Central on July 3
const NOW = new Date('2026-07-03T14:00:00Z');
const FROM = 'phil@rekindleleads.com';
const okTransport = () => ({ sendMail: vi.fn().mockResolvedValue({}) });
const stubDraft = vi.fn().mockResolvedValue('Generated letter body.');

describe('runLetterBatchTick', () => {
  it('does nothing when the enabled flag is off', async () => {
    const db = tickDb();
    const transport = okTransport();
    const r = await runLetterBatchTick(db, { transport, now: NOW, from: FROM, draftFn: stubDraft });
    expect(r.reason).toBe('disabled');
    expect(transport.sendMail).not.toHaveBeenCalled();
  });

  it('sends one email to the default recipient, drafts missing letters, marks leads, stamps the date', async () => {
    const db = tickDb();
    setSetting(db, LETTER_BATCH_ENABLED_KEY, '1');
    const transport = okTransport();
    const r = await runLetterBatchTick(db, { transport, now: NOW, from: FROM, draftFn: stubDraft });
    expect(r).toMatchObject({ sent: 2, skippedDrafts: 0, dryRun: false, recipient: 'thecarolinem@icloud.com' });
    expect(transport.sendMail).toHaveBeenCalledTimes(1);
    const mail = transport.sendMail.mock.calls[0][0];
    expect(mail.to).toBe('thecarolinem@icloud.com');
    expect(mail.text).toContain('Existing letter draft.');   // pre-existing draft reused
    expect(mail.text).toContain('Generated letter body.');   // missing draft generated
    expect(db.prepare("SELECT COUNT(*) n FROM leads WHERE letter_status='sent'").get()).toEqual({ n: 2 });
    expect(db.prepare("SELECT COUNT(*) n FROM outreach_touches WHERE channel='letter'").get()).toEqual({ n: 2 });
    expect(getSetting(db, LETTER_LAST_BATCH_DATE_KEY)).toBe('2026-07-03');
  });

  it('honors the letter_batch_recipient setting', async () => {
    const db = tickDb();
    setSetting(db, LETTER_BATCH_ENABLED_KEY, '1');
    setSetting(db, LETTER_BATCH_RECIPIENT_KEY, 'someone@else.com');
    const transport = okTransport();
    await runLetterBatchTick(db, { transport, now: NOW, from: FROM, draftFn: stubDraft });
    expect(transport.sendMail.mock.calls[0][0].to).toBe('someone@else.com');
  });

  it('refuses a second real batch on the same Central date', async () => {
    const db = tickDb();
    setSetting(db, LETTER_BATCH_ENABLED_KEY, '1');
    setSetting(db, LETTER_LAST_BATCH_DATE_KEY, '2026-07-03');
    const transport = okTransport();
    const r = await runLetterBatchTick(db, { transport, now: NOW, from: FROM, draftFn: stubDraft });
    expect(r.reason).toBe('already-sent-today');
    expect(transport.sendMail).not.toHaveBeenCalled();
  });

  it('dry run sends to the override address and mutates no lead state', async () => {
    const db = tickDb();
    const transport = okTransport();
    const r = await runLetterBatchTick(db, {
      transport, now: NOW, from: FROM, dryRun: true, to: 'philsmith4321@gmail.com', draftFn: stubDraft,
    });
    expect(r).toMatchObject({ sent: 2, dryRun: true, recipient: 'philsmith4321@gmail.com' });
    expect(transport.sendMail.mock.calls[0][0].to).toBe('philsmith4321@gmail.com');
    expect(db.prepare("SELECT COUNT(*) n FROM leads WHERE letter_status='sent'").get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT COUNT(*) n FROM outreach_touches').get()).toEqual({ n: 0 });
    expect(getSetting(db, LETTER_LAST_BATCH_DATE_KEY)).toBeNull();
    // dry run works even with the enabled flag off (it defaults to off here)
  });

  it('a lead whose draft fails is skipped and stays in the pool; the batch ships without it', async () => {
    const db = tickDb();
    setSetting(db, LETTER_BATCH_ENABLED_KEY, '1');
    const transport = okTransport();
    const failDraft = vi.fn().mockResolvedValue(null);
    const r = await runLetterBatchTick(db, { transport, now: NOW, from: FROM, draftFn: failDraft });
    expect(r).toMatchObject({ sent: 1, skippedDrafts: 1 });
    expect(db.prepare('SELECT letter_status FROM leads WHERE id=2').get()).toEqual({ letter_status: null });
  });

  it('returns empty and sends nothing when no leads are eligible', async () => {
    const db = tickDb();
    setSetting(db, LETTER_BATCH_ENABLED_KEY, '1');
    db.exec("UPDATE leads SET letter_status='sent'");
    const transport = okTransport();
    const r = await runLetterBatchTick(db, { transport, now: NOW, from: FROM, draftFn: stubDraft });
    expect(r.reason).toBe('empty');
    expect(transport.sendMail).not.toHaveBeenCalled();
  });

  it('marks nothing when the send fails', async () => {
    const db = tickDb();
    setSetting(db, LETTER_BATCH_ENABLED_KEY, '1');
    const transport = { sendMail: vi.fn().mockRejectedValue(new Error('gmail-api 500')) };
    const r = await runLetterBatchTick(db, { transport, now: NOW, from: FROM, draftFn: stubDraft });
    expect(r.reason).toBe('error');
    expect(r.error).toContain('gmail-api 500');
    expect(db.prepare("SELECT COUNT(*) n FROM leads WHERE letter_status='sent'").get()).toEqual({ n: 0 });
    expect(getSetting(db, LETTER_LAST_BATCH_DATE_KEY)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/letter-batch.test.ts`
Expected: FAIL — `runLetterBatchTick` is not exported.

- [ ] **Step 3: Write the implementation**

Append to `src/lib/outreach/letter-batch.ts` (and add the new imports at the top of the file):

```typescript
// New imports at the top of the file:
import type Database from 'better-sqlite3';
import type { OutreachLead } from '@/lib/queries/outreach-lead-queries';
import type { Transport } from '@/lib/email/outreach-sender';
import { generateDraft } from '@/lib/outreach/draft';
import { getSetting, setSetting } from '@/lib/queries/settings-queries';
import {
  eligibleLetterLeads, saveLetterDraft, markLetterBatchSent,
} from '@/lib/queries/letter-batch-queries';
```

```typescript
export interface LetterTickOpts {
  transport: Transport;
  now: Date;
  from: string;
  // dryRun sends the composed batch (to `to` or the configured recipient)
  // without marking any lead or the daily guard — the format-test path.
  dryRun?: boolean;
  to?: string;
  // Test seam; production uses generateDraft. LetterLead carries every field
  // generateDraft actually reads, so the cast below is safe at runtime.
  draftFn?: (db: Database.Database, lead: LetterLead, channel: 'letter') => Promise<string | null>;
}

export interface LetterTickResult {
  sent: number;
  skippedDrafts: number;
  recipient: string | null;
  dryRun: boolean;
  leadIds: number[];
  reason?: 'disabled' | 'already-sent-today' | 'empty' | 'error';
  error?: string;
}

// One daily batch: pull up to 10 eligible leads, draft any missing letters,
// email the assignment sheet, and (real runs only) mark everything included.
export async function runLetterBatchTick(
  db: Database.Database, opts: LetterTickOpts
): Promise<LetterTickResult> {
  const dryRun = !!opts.dryRun;
  const { isoDate, label } = centralDateParts(opts.now);
  const none = (reason: LetterTickResult['reason']): LetterTickResult =>
    ({ sent: 0, skippedDrafts: 0, recipient: null, dryRun, leadIds: [], reason });

  if (!dryRun) {
    if (getSetting(db, LETTER_BATCH_ENABLED_KEY) !== '1') return none('disabled');
    if (getSetting(db, LETTER_LAST_BATCH_DATE_KEY) === isoDate) return none('already-sent-today');
  }

  const candidates = eligibleLetterLeads(db, LETTER_BATCH_SIZE);
  if (candidates.length === 0) return none('empty');

  const draft = opts.draftFn
    ?? ((d: Database.Database, lead: LetterLead, channel: 'letter') =>
      generateDraft(d, lead as unknown as OutreachLead, channel));

  // Draft any missing letters; a failed draft defers that lead to a later
  // batch (letter_status stays NULL) rather than wedging today's email.
  const ready: LetterLead[] = [];
  let skippedDrafts = 0;
  for (const lead of candidates) {
    if (lead.draft_letter?.trim()) { ready.push(lead); continue; }
    let text: string | null = null;
    try { text = await draft(db, lead, 'letter'); } catch { text = null; }
    if (text?.trim()) {
      saveLetterDraft(db, lead.id, text.trim());
      ready.push({ ...lead, draft_letter: text.trim() });
    } else {
      skippedDrafts++;
    }
  }
  if (ready.length === 0) return { ...none('empty'), skippedDrafts };

  const recipient = opts.to || getSetting(db, LETTER_BATCH_RECIPIENT_KEY) || DEFAULT_LETTER_RECIPIENT;
  const { subject, text } = composeLetterBatchEmail(ready, label);
  try {
    await opts.transport.sendMail({ from: opts.from, to: recipient, subject, text });
  } catch (e) {
    return {
      ...none('error'), skippedDrafts, recipient,
      error: (e instanceof Error ? e.message : String(e)).slice(0, 500),
    };
  }

  const leadIds = ready.map((l) => l.id);
  if (!dryRun) {
    markLetterBatchSent(db, leadIds, isoDate);
    setSetting(db, LETTER_LAST_BATCH_DATE_KEY, isoDate);
  }
  return { sent: ready.length, skippedDrafts, recipient, dryRun, leadIds };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/letter-batch.test.ts`
Expected: PASS (15 tests)

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/outreach/letter-batch.ts tests/letter-batch.test.ts
git commit -m "feat: daily letter batch tick orchestrator"
```

---

### Task 5: API route `POST /api/outreach/letter-batch-tick`

**Files:**
- Create: `src/app/api/outreach/letter-batch-tick/route.ts`

**Interfaces:**
- Consumes: `runLetterBatchTick` (Task 4); `buildTransport` from `@/lib/email/outreach-sender`; `getDb` from `@/lib/db`; env vars `OUTREACH_CRON_SECRET`, `OUTREACH_SMTP_FROM`/`OUTREACH_SMTP_USER` (all already set on the droplet for send-tick).
- Produces: the cron/ops endpoint. Optional JSON body `{ "dryRun": true, "to": "..." }`.

Route handlers are thin, untested glue in this codebase (`send-tick/route.ts` has no test); logic lives in the tested lib. No unit test for this task — verification is the build plus the on-server dry run in Task 6.

- [ ] **Step 1: Write the route**

```typescript
// src/app/api/outreach/letter-batch-tick/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { buildTransport } from '@/lib/email/outreach-sender';
import { runLetterBatchTick } from '@/lib/outreach/letter-batch';

export async function POST(request: NextRequest) {
  const secret = process.env.OUTREACH_CRON_SECRET;
  if (!secret || request.headers.get('x-cron-secret') !== secret)
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const from = process.env.OUTREACH_SMTP_FROM || process.env.OUTREACH_SMTP_USER;
  if (!from) return NextResponse.json({ error: 'sender not configured' }, { status: 500 });
  const body = await request.json().catch(() => ({}));
  const db = getDb();
  const result = await runLetterBatchTick(db, {
    transport: buildTransport(),
    now: new Date(),
    from,
    dryRun: body?.dryRun === true,
    to: typeof body?.to === 'string' && body.to.trim() ? body.to.trim() : undefined,
  });
  return NextResponse.json(result);
}
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: build succeeds, route `/api/outreach/letter-batch-tick` appears in the route list.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/outreach/letter-batch-tick/route.ts
git commit -m "feat: letter-batch-tick cron endpoint"
```

---

### Task 6: Deploy, dry-run test email to Phil, install cron

This task is operational — no code. It deploys, fires the format-test email to Phil, and installs the (safe-while-disabled) daily cron. **STOP after the dry run and wait for Phil's approval before arming `letter_batch_enabled`.**

- [ ] **Step 1: Push and deploy**

```bash
git push origin main
bash scripts/deploy.sh
```

Expected: deploy script finishes with a PM2 restart of `commandpost`.

- [ ] **Step 2: Fire the dry-run batch to Phil**

On the droplet (the secret lives in the server's `.env`):

```bash
ssh root@143.244.169.43 'cd /root/commandpost 2>/dev/null || cd /var/www/commandpost; \
  SECRET=$(grep ^OUTREACH_CRON_SECRET .env | cut -d= -f2-); \
  curl -s -X POST http://localhost:3000/api/outreach/letter-batch-tick \
    -H "x-cron-secret: $SECRET" -H "Content-Type: application/json" \
    -d "{\"dryRun\": true, \"to\": \"philsmith4321@gmail.com\"}"'
```

(Adjust the app directory to wherever `deploy.sh` targets — check the script.)

Expected JSON: `{"sent": <1-10>, "skippedDrafts": 0, "recipient": "philsmith4321@gmail.com", "dryRun": true, "leadIds": [...]}`.

Then verify no state changed:

```bash
ssh root@143.244.169.43 'sqlite3 <app-dir>/data/commandpost.db \
  "SELECT COUNT(*) FROM leads WHERE letter_status IS NOT NULL;"'
```

Expected: `0`.

- [ ] **Step 3: Install the daily cron (safe while the flag is off)**

```bash
ssh root@143.244.169.43 'crontab -l'   # confirm the send-tick entry pattern first
```

Append (matching whatever env/secret style the existing send-tick entry uses):

```
0 13 * * * curl -s -X POST http://localhost:3000/api/outreach/letter-batch-tick -H "x-cron-secret: <same secret as send-tick entry>" >> /var/log/letter-batch.log 2>&1
```

- [ ] **Step 4: STOP — report to Phil**

Tell Phil the test email is in his inbox (philsmith4321@gmail.com) and that nothing is armed. Do NOT proceed.

- [ ] **Step 5 (ONLY after Phil approves the format): arm and launch**

```bash
ssh root@143.244.169.43 'sqlite3 <app-dir>/data/commandpost.db \
  "INSERT OR REPLACE INTO app_settings (key, value) VALUES (\"letter_batch_enabled\", \"1\");"'
# Fire the first real batch to Caroline immediately:
ssh root@143.244.169.43 '... curl -s -X POST http://localhost:3000/api/outreach/letter-batch-tick -H "x-cron-secret: $SECRET"'
```

Expected: `{"sent": 10, "recipient": "thecarolinem@icloud.com", "dryRun": false, ...}`; the 10 leads now have `letter_status='sent'` and tomorrow's 13:00 UTC cron takes over.
