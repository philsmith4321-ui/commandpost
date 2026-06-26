# Outreach Email Queue + Auto-Sender Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a review → queue → auto-send pipeline for the outreach email channel so an operator approves bulk-drafted emails on a page and CommandPost auto-sends 10–15 per weekday from a rekindleleads.com Gmail mailbox.

**Architecture:** Additive `leads` columns track each email's status (`draft`→`queued`→`sent`/`skipped`/`failed`) plus a `do_not_email` flag. Pure logic (subject/body parsing, deterministic daily target, send-eligibility) lives in a testable module. A secret-protected `/api/outreach/send-tick` endpoint, hit by a Droplet cron during business hours, sends one queued email per tick via an injected `nodemailer` Gmail-SMTP transport, capped at a per-day random 10–15. A 3-tab "Email Queue" React page drives review/queue/sent.

**Tech Stack:** Next.js 16 (App Router), better-sqlite3, nodemailer (Gmail SMTP + App Password), vitest, Tailwind. Path alias `@/` → `src/`. Tests in `tests/`. SMTP creds + cron secret in server `.env` (runtime, like `ANTHROPIC_API_KEY`).

---

## File Structure

- **Create** `src/lib/outreach/email-queue.ts` — pure logic: `parseEmail()`, `dailyTarget()`, `isSendable()`, status constants. No DB/IO.
- **Create** `src/lib/queries/outreach-email-queue-queries.ts` — all DB access for the queue (list by tab, transitions, counts, next-queued, mark sent/failed, do_not_email).
- **Create** `src/lib/email/outreach-sender.ts` — `buildTransport()` (nodemailer) + `sendOneTick(db, { transport, now })` orchestration.
- **Create** `src/app/api/outreach/email-queue/route.ts` — GET list by tab; POST actions (approve/skip/unqueue/retry/edit/do-not-email).
- **Create** `src/app/api/outreach/send-tick/route.ts` — POST, `x-cron-secret` guarded; calls `sendOneTick`.
- **Create** `src/app/(dashboard)/outreach/email-queue/page.tsx` — server page shell.
- **Create** `src/components/outreach-email-queue.tsx` — client 3-tab UI.
- **Modify** `src/lib/db.ts` — additive migration (5 columns on `leads`) + backfill.
- **Modify** dashboard nav (locate the sidebar/nav component) — add "Email Queue" link.
- **Modify** `package.json` — add `nodemailer` + `@types/nodemailer`.
- **Create** tests under `tests/lib/` and `tests/email/`.

Status string constants (used everywhere; define once in `email-queue.ts`):
`EMAIL_STATUS = { DRAFT:'draft', QUEUED:'queued', SENT:'sent', SKIPPED:'skipped', FAILED:'failed' }`.

---

## Task 1: Database migration + backfill

**Files:**
- Modify: `src/lib/db.ts` (append a new guarded migration block near the other `ALTER TABLE leads` migrations)

- [ ] **Step 1: Add the migration block**

Add after the last `leads` migration in `src/lib/db.ts` (follow the existing column-exists guard style):

```typescript
// Outreach email queue: per-lead email pipeline status + suppression.
{
  const cols = db.prepare("PRAGMA table_info(leads)").all() as { name: string }[];
  const have = new Set(cols.map((c) => c.name));
  const add: Array<[string, string]> = [
    ['email_status', 'TEXT'],
    ['email_queued_at', 'TEXT'],
    ['email_sent_at_q', 'TEXT'], // queue send-stamp (distinct from the derived touch column)
    ['email_error', 'TEXT'],
    ['do_not_email', 'INTEGER NOT NULL DEFAULT 0'],
  ];
  for (const [name, decl] of add) {
    if (!have.has(name)) db.exec(`ALTER TABLE leads ADD COLUMN ${name} ${decl}`);
  }
  // Backfill: any lead that already has an email draft but no status becomes 'draft'.
  db.exec(
    "UPDATE leads SET email_status='draft' WHERE email_status IS NULL AND draft_email IS NOT NULL AND trim(draft_email) <> ''"
  );
}
```

Note: the queue's own send timestamp is `email_sent_at_q` to avoid colliding with the existing `email_sent_at` alias that `listLeadsByLane` derives from `outreach_touches`.

- [ ] **Step 2: Verify it loads without error**

Run: `cd ~/cp-emailqueue && node -e "require('better-sqlite3'); const {initDb}=require('./.next/...')" ` is awkward pre-build; instead verify via the migration test in Task 2's harness, or a quick script:

Run:
```bash
cd ~/cp-emailqueue && node -e "
const Database=require('better-sqlite3'); const db=new Database(':memory:');
db.exec('CREATE TABLE leads (id INTEGER PRIMARY KEY, draft_email TEXT)');
db.exec('INSERT INTO leads (draft_email) VALUES (\\'Subject: x\\n\\nhi\\')');
const cols=db.prepare('PRAGMA table_info(leads)').all().map(c=>c.name);
console.log('ok baseline', cols.join(','));
"
```
Expected: prints baseline columns (sanity that better-sqlite3 works). Full migration is exercised by app boot.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat(outreach): email-queue columns on leads + backfill"
```

---

## Task 2: Pure logic module (`email-queue.ts`) — TDD

**Files:**
- Create: `src/lib/outreach/email-queue.ts`
- Test: `tests/lib/email-queue.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/lib/email-queue.test.ts
import { describe, it, expect } from 'vitest';
import { parseEmail, dailyTarget, isSendable, EMAIL_STATUS } from '@/lib/outreach/email-queue';

describe('parseEmail', () => {
  it('splits a "Subject:" first line from the body', () => {
    const r = parseEmail('Subject: the honest version\n\nHi Sam,\nbody here');
    expect(r.subject).toBe('the honest version');
    expect(r.body).toBe('Hi Sam,\nbody here');
  });
  it('falls back to a default subject when none present', () => {
    const r = parseEmail('Hi Sam,\nno subject line');
    expect(r.subject).toBe('Quick note from RekindleLeads');
    expect(r.body).toBe('Hi Sam,\nno subject line');
  });
});

describe('dailyTarget', () => {
  it('is deterministic per date and within 10..15', () => {
    const a = dailyTarget('2026-06-29');
    const b = dailyTarget('2026-06-29');
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(10);
    expect(a).toBeLessThanOrEqual(15);
  });
  it('varies across dates', () => {
    const vals = ['2026-06-29','2026-06-30','2026-07-01','2026-07-02'].map(dailyTarget);
    expect(new Set(vals).size).toBeGreaterThan(1);
  });
});

describe('isSendable', () => {
  const base = { email: 'a@b.com', email_status: EMAIL_STATUS.QUEUED, do_not_email: 0, replied_at: null, email_sent_at_q: null };
  it('true for a clean queued lead with an email', () => {
    expect(isSendable(base)).toBe(true);
  });
  it('false when suppressed / replied / already sent / not queued / no email', () => {
    expect(isSendable({ ...base, do_not_email: 1 })).toBe(false);
    expect(isSendable({ ...base, replied_at: '2026-06-28' })).toBe(false);
    expect(isSendable({ ...base, email_sent_at_q: '2026-06-28' })).toBe(false);
    expect(isSendable({ ...base, email_status: EMAIL_STATUS.DRAFT })).toBe(false);
    expect(isSendable({ ...base, email: null })).toBe(false);
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `cd ~/cp-emailqueue && npx vitest run tests/lib/email-queue.test.ts`
Expected: FAIL — module `@/lib/outreach/email-queue` not found.

- [ ] **Step 3: Implement the module**

```typescript
// src/lib/outreach/email-queue.ts
export const EMAIL_STATUS = {
  DRAFT: 'draft',
  QUEUED: 'queued',
  SENT: 'sent',
  SKIPPED: 'skipped',
  FAILED: 'failed',
} as const;
export type EmailStatus = (typeof EMAIL_STATUS)[keyof typeof EMAIL_STATUS];

const DEFAULT_SUBJECT = 'Quick note from RekindleLeads';

// Split a generated email into a subject line and body. Drafts start with
// "Subject: ..." then a blank line then the body (see outreach/draft.ts email shape).
export function parseEmail(draft: string): { subject: string; body: string } {
  const text = (draft ?? '').replace(/\r\n/g, '\n').trim();
  const m = text.match(/^subject:\s*(.+?)\n\s*\n([\s\S]*)$/i);
  if (m) return { subject: m[1].trim(), body: m[2].trim() };
  const single = text.match(/^subject:\s*(.+)$/i);
  if (single) return { subject: single[1].trim(), body: '' };
  return { subject: DEFAULT_SUBJECT, body: text };
}

// Deterministic per-day send target in [10,15]. Seeded by the YYYY-MM-DD string so
// every tick that day agrees on the cap (no DB state needed).
export function dailyTarget(isoDate: string): number {
  let h = 0;
  for (let i = 0; i < isoDate.length; i++) h = (h * 31 + isoDate.charCodeAt(i)) >>> 0;
  return 10 + (h % 6); // 10..15
}

export interface SendableLead {
  email: string | null;
  email_status: string | null;
  do_not_email: number | null;
  replied_at: string | null;
  email_sent_at_q: string | null;
}

// Defense in depth: a lead is sendable only if queued, has an address, isn't
// suppressed, hasn't replied, and hasn't already been sent.
export function isSendable(l: SendableLead): boolean {
  return (
    !!l.email && l.email.trim() !== '' &&
    l.email_status === EMAIL_STATUS.QUEUED &&
    !l.do_not_email &&
    !l.replied_at &&
    !l.email_sent_at_q
  );
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `cd ~/cp-emailqueue && npx vitest run tests/lib/email-queue.test.ts`
Expected: PASS (7 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/lib/outreach/email-queue.ts tests/lib/email-queue.test.ts
git commit -m "feat(outreach): email-queue pure logic (parse, daily target, sendable)"
```

---

## Task 3: Queue queries — TDD the transitions

**Files:**
- Create: `src/lib/queries/outreach-email-queue-queries.ts`
- Test: `tests/lib/outreach-email-queue-queries.test.ts`

- [ ] **Step 1: Write the failing test** (in-memory DB with a minimal `leads` table)

```typescript
// tests/lib/outreach-email-queue-queries.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  listByTab, approve, skip, unqueue, retry, setDoNotEmail,
  sentTodayCount, nextSendable, markSent, markFailed,
} from '@/lib/queries/outreach-email-queue-queries';
import { EMAIL_STATUS } from '@/lib/outreach/email-queue';

function freshDb() {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE leads (
    id INTEGER PRIMARY KEY, business_name TEXT, contact_person TEXT, email TEXT,
    stage TEXT DEFAULT 'new', replied_at TEXT, draft_email TEXT,
    email_status TEXT, email_queued_at TEXT, email_sent_at_q TEXT, email_error TEXT,
    do_not_email INTEGER NOT NULL DEFAULT 0, updated_at TEXT
  )`);
  const ins = db.prepare("INSERT INTO leads (business_name,email,draft_email,email_status) VALUES (?,?,?,?)");
  ins.run('A','a@x.com','Subject: hi\n\nbody','draft');
  ins.run('B','b@x.com','Subject: hi\n\nbody','draft');
  return db;
}

describe('email queue queries', () => {
  let db: Database.Database;
  beforeEach(() => { db = freshDb(); });

  it('approve moves draft -> queued and stamps queued_at', () => {
    approve(db, 1);
    const row = db.prepare('SELECT email_status,email_queued_at FROM leads WHERE id=1').get() as any;
    expect(row.email_status).toBe(EMAIL_STATUS.QUEUED);
    expect(row.email_queued_at).toBeTruthy();
    expect(listByTab(db, 'queued').length).toBe(1);
    expect(listByTab(db, 'review').length).toBe(1);
  });

  it('skip / unqueue / retry transitions', () => {
    skip(db, 1);
    expect((db.prepare('SELECT email_status s FROM leads WHERE id=1').get() as any).s).toBe(EMAIL_STATUS.SKIPPED);
    approve(db, 2); unqueue(db, 2);
    expect((db.prepare('SELECT email_status s FROM leads WHERE id=2').get() as any).s).toBe(EMAIL_STATUS.DRAFT);
    markFailed(db, 2, 'smtp boom'); retry(db, 2);
    expect((db.prepare('SELECT email_status s FROM leads WHERE id=2').get() as any).s).toBe(EMAIL_STATUS.QUEUED);
  });

  it('nextSendable returns oldest queued, markSent finalizes, sentTodayCount counts today', () => {
    approve(db, 1); approve(db, 2);
    const n = nextSendable(db);
    expect(n!.id).toBe(1);
    markSent(db, 1);
    const row = db.prepare('SELECT email_status,email_sent_at_q FROM leads WHERE id=1').get() as any;
    expect(row.email_status).toBe(EMAIL_STATUS.SENT);
    expect(sentTodayCount(db)).toBe(1);
  });

  it('setDoNotEmail removes a lead from sendable', () => {
    approve(db, 1); setDoNotEmail(db, 1, true);
    expect(nextSendable(db)?.id).not.toBe(1);
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `cd ~/cp-emailqueue && npx vitest run tests/lib/outreach-email-queue-queries.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the queries**

```typescript
// src/lib/queries/outreach-email-queue-queries.ts
import type Database from 'better-sqlite3';
import { EMAIL_STATUS, isSendable, type SendableLead } from '@/lib/outreach/email-queue';

export type Tab = 'review' | 'queued' | 'sent';

export interface QueueLead {
  id: number; business_name: string | null; contact_person: string | null;
  email: string | null; draft_email: string | null; email_status: string | null;
  email_queued_at: string | null; email_sent_at_q: string | null; email_error: string | null;
  do_not_email: number | null; replied_at: string | null;
}

const SELECT = `SELECT id, business_name, contact_person, email, draft_email, email_status,
  email_queued_at, email_sent_at_q, email_error, do_not_email, replied_at FROM leads`;

export function listByTab(db: Database.Database, tab: Tab): QueueLead[] {
  if (tab === 'review')
    return db.prepare(`${SELECT} WHERE email_status = ? ORDER BY id`).all(EMAIL_STATUS.DRAFT) as QueueLead[];
  if (tab === 'queued')
    return db.prepare(`${SELECT} WHERE email_status = ? ORDER BY email_queued_at, id`).all(EMAIL_STATUS.QUEUED) as QueueLead[];
  return db.prepare(`${SELECT} WHERE email_status IN (?, ?) ORDER BY email_sent_at_q DESC, id`)
    .all(EMAIL_STATUS.SENT, EMAIL_STATUS.FAILED) as QueueLead[];
}

function setStatus(db: Database.Database, id: number, status: string, extra = '') {
  db.prepare(`UPDATE leads SET email_status=?${extra}, updated_at=datetime('now') WHERE id=?`).run(status, id);
}

export function approve(db: Database.Database, id: number) {
  db.prepare(`UPDATE leads SET email_status=?, email_queued_at=datetime('now'), email_error=NULL, updated_at=datetime('now')
    WHERE id=? AND email IS NOT NULL AND trim(email) <> ''`).run(EMAIL_STATUS.QUEUED, id);
}
export function skip(db: Database.Database, id: number) { setStatus(db, id, EMAIL_STATUS.SKIPPED); }
export function unqueue(db: Database.Database, id: number) {
  db.prepare(`UPDATE leads SET email_status=?, email_queued_at=NULL, updated_at=datetime('now') WHERE id=?`)
    .run(EMAIL_STATUS.DRAFT, id);
}
export function retry(db: Database.Database, id: number) {
  db.prepare(`UPDATE leads SET email_status=?, email_error=NULL, email_queued_at=datetime('now'), updated_at=datetime('now') WHERE id=?`)
    .run(EMAIL_STATUS.QUEUED, id);
}
export function editDraft(db: Database.Database, id: number, body: string) {
  db.prepare(`UPDATE leads SET draft_email=?, updated_at=datetime('now') WHERE id=?`).run(body, id);
}
export function setDoNotEmail(db: Database.Database, id: number, on: boolean) {
  db.prepare(`UPDATE leads SET do_not_email=?, updated_at=datetime('now') WHERE id=?`).run(on ? 1 : 0, id);
}

export function sentTodayCount(db: Database.Database): number {
  return (db.prepare(
    `SELECT COUNT(*) n FROM leads WHERE email_status=? AND date(email_sent_at_q)=date('now','localtime')`
  ).get(EMAIL_STATUS.SENT) as { n: number }).n;
}

// Oldest queued lead that passes every send guard, or null.
export function nextSendable(db: Database.Database): QueueLead | null {
  const rows = db.prepare(`${SELECT} WHERE email_status=? ORDER BY email_queued_at, id`).all(EMAIL_STATUS.QUEUED) as QueueLead[];
  return rows.find((r) => isSendable(r as unknown as SendableLead)) ?? null;
}

export function markSent(db: Database.Database, id: number) {
  db.prepare(`UPDATE leads SET email_status=?, email_sent_at_q=datetime('now'), email_error=NULL, updated_at=datetime('now') WHERE id=?`)
    .run(EMAIL_STATUS.SENT, id);
}
export function markFailed(db: Database.Database, id: number, err: string) {
  db.prepare(`UPDATE leads SET email_status=?, email_error=?, updated_at=datetime('now') WHERE id=?`)
    .run(EMAIL_STATUS.FAILED, err.slice(0, 500), id);
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `cd ~/cp-emailqueue && npx vitest run tests/lib/outreach-email-queue-queries.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/outreach-email-queue-queries.ts tests/lib/outreach-email-queue-queries.test.ts
git commit -m "feat(outreach): email-queue DB queries + transitions"
```

---

## Task 4: Sender module with injected transport — TDD

**Files:**
- Create: `src/lib/email/outreach-sender.ts`
- Test: `tests/email/outreach-sender.test.ts`

- [ ] **Step 1: Write the failing test** (mock transport; reuse the freshDb shape from Task 3)

```typescript
// tests/email/outreach-sender.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { sendOneTick } from '@/lib/email/outreach-sender';
import { approve, markSent } from '@/lib/queries/outreach-email-queue-queries';

function freshDb() {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE leads (
    id INTEGER PRIMARY KEY, business_name TEXT, contact_person TEXT, email TEXT,
    stage TEXT DEFAULT 'new', replied_at TEXT, draft_email TEXT,
    email_status TEXT, email_queued_at TEXT, email_sent_at_q TEXT, email_error TEXT,
    do_not_email INTEGER NOT NULL DEFAULT 0, updated_at TEXT
  )`);
  db.exec(`CREATE TABLE outreach_touches (id INTEGER PRIMARY KEY, lead_id INTEGER, channel TEXT, sent_at TEXT DEFAULT (datetime('now')), note TEXT, created_at TEXT DEFAULT (datetime('now')))`);
  const ins = db.prepare("INSERT INTO leads (business_name,email,draft_email,email_status,email_queued_at) VALUES (?,?,?,?,datetime('now'))");
  ins.run('A','a@x.com','Subject: hi A\n\nbody A','queued');
  ins.run('B','b@x.com','Subject: hi B\n\nbody B','queued');
  return db;
}
const fakeNow = new Date('2026-06-29T14:00:00-05:00'); // a Monday, 2pm Central

describe('sendOneTick', () => {
  let db: Database.Database; let sent: any[];
  const transport = { sendMail: async (m: any) => { sent.push(m); return { messageId: 'x' }; } };
  beforeEach(() => { db = freshDb(); sent = []; });

  it('sends exactly one queued email and marks it sent + logs a touch', async () => {
    const r = await sendOneTick(db, { transport: transport as any, now: fakeNow, from: 'phil@rekindleleads.com' });
    expect(r.sent).toBe(true);
    expect(sent.length).toBe(1);
    expect(sent[0].to).toBe('a@x.com');
    expect(sent[0].subject).toBe('hi A');
    const row = db.prepare("SELECT email_status FROM leads WHERE id=1").get() as any;
    expect(row.email_status).toBe('sent');
    expect((db.prepare("SELECT COUNT(*) n FROM outreach_touches WHERE lead_id=1 AND channel='email'").get() as any).n).toBe(1);
  });

  it('does nothing outside business hours', async () => {
    const evening = new Date('2026-06-29T21:00:00-05:00');
    const r = await sendOneTick(db, { transport: transport as any, now: evening, from: 'p@r.com' });
    expect(r.sent).toBe(false); expect(r.reason).toBe('outside-hours'); expect(sent.length).toBe(0);
  });

  it('does nothing on weekends', async () => {
    const sun = new Date('2026-06-28T14:00:00-05:00');
    const r = await sendOneTick(db, { transport: transport as any, now: sun, from: 'p@r.com' });
    expect(r.sent).toBe(false); expect(r.reason).toBe('weekend');
  });

  it('stops once the daily target is reached', async () => {
    // mark enough sent today to exceed any target (max 15)
    for (let i = 0; i < 15; i++) { db.prepare("INSERT INTO leads (email,email_status,email_sent_at_q) VALUES ('z@x.com','sent',datetime('now','localtime'))").run(); }
    const r = await sendOneTick(db, { transport: transport as any, now: fakeNow, from: 'p@r.com' });
    expect(r.sent).toBe(false); expect(r.reason).toBe('daily-cap'); expect(sent.length).toBe(0);
  });

  it('records failure without crashing', async () => {
    const boom = { sendMail: async () => { throw new Error('smtp down'); } };
    const r = await sendOneTick(db, { transport: boom as any, now: fakeNow, from: 'p@r.com' });
    expect(r.sent).toBe(false); expect(r.reason).toBe('error');
    expect((db.prepare("SELECT email_status FROM leads WHERE id=1").get() as any).email_status).toBe('failed');
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `cd ~/cp-emailqueue && npx vitest run tests/email/outreach-sender.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the sender**

```typescript
// src/lib/email/outreach-sender.ts
import type Database from 'better-sqlite3';
import nodemailer from 'nodemailer';
import { parseEmail, dailyTarget } from '@/lib/outreach/email-queue';
import { nextSendable, sentTodayCount, markSent, markFailed } from '@/lib/queries/outreach-email-queue-queries';

export interface Transport { sendMail(mail: { from: string; to: string; subject: string; text: string }): Promise<unknown>; }

// Gmail SMTP via App Password. Creds from server .env (runtime).
export function buildTransport(): Transport {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: process.env.OUTREACH_SMTP_USER || '', pass: process.env.OUTREACH_SMTP_PASS || '' },
  }) as unknown as Transport;
}

const TZ = 'America/Chicago';
function centralParts(now: Date): { dow: number; hour: number; isoDate: string } {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', hour: 'numeric', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit' });
  const p = Object.fromEntries(fmt.formatToParts(now).map((x) => [x.type, x.value]));
  const dowMap: Record<string, number> = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };
  return { dow: dowMap[p.weekday as string], hour: parseInt(p.hour as string, 10) % 24, isoDate: `${p.year}-${p.month}-${p.day}` };
}

export interface TickOpts { transport: Transport; now: Date; from: string; }
export interface TickResult { sent: boolean; reason?: 'weekend'|'outside-hours'|'daily-cap'|'empty'|'error'; leadId?: number; }

// One send attempt: honor weekday/business-hours/daily-cap, then send the oldest
// sendable queued email. Designed to be called repeatedly by a cron tick.
export async function sendOneTick(db: Database.Database, opts: TickOpts): Promise<TickResult> {
  const { dow, hour, isoDate } = centralParts(opts.now);
  if (dow === 0 || dow === 6) return { sent: false, reason: 'weekend' };
  if (hour < 9 || hour >= 17) return { sent: false, reason: 'outside-hours' };
  if (sentTodayCount(db) >= dailyTarget(isoDate)) return { sent: false, reason: 'daily-cap' };

  const lead = nextSendable(db);
  if (!lead) return { sent: false, reason: 'empty' };
  const { subject, body } = parseEmail(lead.draft_email || '');
  try {
    await opts.transport.sendMail({ from: opts.from, to: lead.email as string, subject, text: body });
    markSent(db, lead.id);
    db.prepare("INSERT INTO outreach_touches (lead_id, channel, note) VALUES (?, 'email', 'auto-sent')").run(lead.id);
    db.prepare("UPDATE leads SET stage='contacted' WHERE id=? AND stage='new'").run(lead.id);
    return { sent: true, leadId: lead.id };
  } catch (e) {
    markFailed(db, lead.id, e instanceof Error ? e.message : String(e));
    return { sent: false, reason: 'error', leadId: lead.id };
  }
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `cd ~/cp-emailqueue && npx vitest run tests/email/outreach-sender.test.ts`
Expected: PASS (5 cases).

- [ ] **Step 5: Add nodemailer dep + commit**

```bash
cd ~/cp-emailqueue && npm install nodemailer && npm install -D @types/nodemailer
git add package.json package-lock.json src/lib/email/outreach-sender.ts tests/email/outreach-sender.test.ts
git commit -m "feat(outreach): throttled Gmail-SMTP sender (sendOneTick), injected transport"
```

---

## Task 5: Email-queue API route (list + actions)

**Files:**
- Create: `src/app/api/outreach/email-queue/route.ts`

- [ ] **Step 1: Implement the route**

```typescript
// src/app/api/outreach/email-queue/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { listByTab, approve, skip, unqueue, retry, editDraft, setDoNotEmail, type Tab } from '@/lib/queries/outreach-email-queue-queries';

const TABS: Tab[] = ['review', 'queued', 'sent'];

export async function GET(request: NextRequest) {
  const db = getDb();
  const tab = (request.nextUrl.searchParams.get('tab') || 'review') as Tab;
  const safe: Tab = TABS.includes(tab) ? tab : 'review';
  const counts = { review: listByTab(db, 'review').length, queued: listByTab(db, 'queued').length, sent: listByTab(db, 'sent').length };
  return NextResponse.json({ tab: safe, leads: listByTab(db, safe), counts });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  const id = Number(body.leadId);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'invalid leadId' }, { status: 400 });
  const db = getDb();
  switch (body.action) {
    case 'approve': approve(db, id); break;
    case 'skip': skip(db, id); break;
    case 'unqueue': unqueue(db, id); break;
    case 'retry': retry(db, id); break;
    case 'edit':
      if (typeof body.body !== 'string') return NextResponse.json({ error: 'invalid body text' }, { status: 400 });
      editDraft(db, id, body.body); break;
    case 'do-not-email': setDoNotEmail(db, id, !!body.on); break;
    default: return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Typecheck**

Run: `cd ~/cp-emailqueue && npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/outreach/email-queue/route.ts
git commit -m "feat(outreach): email-queue API (list + approve/skip/unqueue/retry/edit/do-not-email)"
```

---

## Task 6: Send-tick API route (secret-guarded)

**Files:**
- Create: `src/app/api/outreach/send-tick/route.ts`

- [ ] **Step 1: Implement the route**

```typescript
// src/app/api/outreach/send-tick/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { buildTransport, sendOneTick } from '@/lib/email/outreach-sender';

export async function POST(request: NextRequest) {
  const secret = process.env.OUTREACH_CRON_SECRET;
  if (!secret || request.headers.get('x-cron-secret') !== secret)
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const from = process.env.OUTREACH_SMTP_FROM || process.env.OUTREACH_SMTP_USER;
  if (!from) return NextResponse.json({ error: 'sender not configured' }, { status: 500 });
  const db = getDb();
  const result = await sendOneTick(db, { transport: buildTransport(), now: new Date(), from });
  return NextResponse.json(result);
}
```

- [ ] **Step 2: Typecheck**

Run: `cd ~/cp-emailqueue && npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/outreach/send-tick/route.ts
git commit -m "feat(outreach): secret-guarded send-tick endpoint"
```

---

## Task 7: Email Queue UI (page + 3-tab client component)

**Files:**
- Create: `src/app/(dashboard)/outreach/email-queue/page.tsx`
- Create: `src/components/outreach-email-queue.tsx`

- [ ] **Step 1: Server page shell**

```tsx
// src/app/(dashboard)/outreach/email-queue/page.tsx
import OutreachEmailQueue from '@/components/outreach-email-queue';
export default function Page() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-white mb-4">Email Queue</h1>
      <OutreachEmailQueue />
    </div>
  );
}
```

- [ ] **Step 2: Client component** (3 tabs; Review = step-through; Queued = list w/ projected date; Sent = log + retry)

```tsx
// src/components/outreach-email-queue.tsx
'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { parseEmail, dailyTarget } from '@/lib/outreach/email-queue';

type Tab = 'review' | 'queued' | 'sent';
interface Lead { id: number; business_name: string|null; contact_person: string|null; email: string|null; draft_email: string|null; email_status: string|null; email_queued_at: string|null; email_sent_at_q: string|null; email_error: string|null; do_not_email: number|null; }

export default function OutreachEmailQueue() {
  const [tab, setTab] = useState<Tab>('review');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [counts, setCounts] = useState({ review: 0, queued: 0, sent: 0 });
  const [idx, setIdx] = useState(0);
  const [draft, setDraft] = useState('');

  const load = useCallback(async (t: Tab) => {
    const res = await fetch(`/api/outreach/email-queue?tab=${t}`);
    if (res.ok) { const d = await res.json(); setLeads(d.leads); setCounts(d.counts); setIdx(0); }
  }, []);
  useEffect(() => { load(tab); }, [tab, load]);
  useEffect(() => { setDraft(leads[idx]?.draft_email ?? ''); }, [leads, idx]);

  async function act(leadId: number, body: Record<string, unknown>) {
    await fetch('/api/outreach/email-queue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId, ...body }) });
    await load(tab);
  }
  const cur = leads[idx];
  const parsed = useMemo(() => parseEmail(draft || ''), [draft]);

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(['review','queued','sent'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm ${tab===t?'bg-blue-600 text-white':'bg-gray-800 text-gray-300'}`}>
            {t[0].toUpperCase()+t.slice(1)} · {counts[t]}
          </button>
        ))}
      </div>

      {tab === 'review' && (cur ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 max-w-2xl">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>{idx+1} / {leads.length} · <span className="text-white">{cur.business_name}</span>{cur.contact_person?` · ${cur.contact_person}`:''}</span>
            <span className="space-x-2"><button disabled={idx===0} onClick={()=>setIdx(i=>i-1)} className="disabled:opacity-30">◀ prev</button><button disabled={idx>=leads.length-1} onClick={()=>setIdx(i=>i+1)} className="disabled:opacity-30">next ▶</button></span>
          </div>
          <div className="text-xs text-gray-500">To: {cur.email}</div>
          <div className="text-xs text-gray-500 mb-2">Subject: <span className="text-gray-300">{parsed.subject}</span></div>
          <textarea value={draft} onChange={(e)=>setDraft(e.target.value)} onBlur={()=>cur && draft!==cur.draft_email && act(cur.id,{action:'edit',body:draft})}
            rows={12} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white" />
          <div className="mt-2 flex gap-2">
            <button onClick={()=>act(cur.id,{action:'skip'})} className="px-3 py-1 rounded-lg bg-gray-800 hover:bg-red-600 text-xs text-white">✗ Skip</button>
            <button onClick={()=>act(cur.id,{action:'approve'})} className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs text-white">✓ Approve → Queue</button>
            <button onClick={()=>act(cur.id,{action:'do-not-email',on:true})} className="ml-auto px-3 py-1 rounded-lg bg-gray-800 text-xs text-gray-400">Do-not-email</button>
          </div>
        </div>
      ) : <p className="text-gray-500">No drafts to review.</p>)}

      {tab === 'queued' && (
        <div className="space-y-1 max-w-2xl">
          {leads.length===0 && <p className="text-gray-500">Queue is empty.</p>}
          {leads.map((l, i) => {
            const perDay = 12; const sendsInDays = Math.floor(i / perDay);
            return (
              <div key={l.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2 text-sm">
                <span className="text-white">{l.business_name} <span className="text-gray-500">· {l.email}</span></span>
                <span className="flex items-center gap-3 text-xs text-gray-400">
                  <span>sends in ~{sendsInDays===0?'today':sendsInDays+'d'}</span>
                  <button onClick={()=>act(l.id,{action:'unqueue'})} className="hover:text-white underline">un-queue</button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'sent' && (
        <div className="space-y-1 max-w-2xl">
          {leads.length===0 && <p className="text-gray-500">Nothing sent yet.</p>}
          {leads.map((l) => (
            <div key={l.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2 text-sm">
              <span className="text-white">{l.business_name} <span className="text-gray-500">· {l.email}</span></span>
              {l.email_status==='failed'
                ? <span className="flex items-center gap-2 text-xs text-red-400">failed: {l.email_error?.slice(0,40)} <button onClick={()=>act(l.id,{action:'retry'})} className="underline text-gray-300">retry</button></span>
                : <span className="text-xs text-emerald-400">sent {l.email_sent_at_q?.slice(0,10)}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

Note: `dailyTarget` import is used to keep the per-day estimate honest if you later surface it; the simple `perDay=12` midpoint is fine for the v1 estimate.

- [ ] **Step 3: Typecheck + build**

Run: `cd ~/cp-emailqueue && npx tsc --noEmit -p tsconfig.json`
Expected: exit 0. (If `dailyTarget` is unused, drop it from the import to satisfy lint.)

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/outreach/email-queue/page.tsx" src/components/outreach-email-queue.tsx
git commit -m "feat(outreach): Email Queue page (review/queued/sent tabs)"
```

---

## Task 8: Navigation link

**Files:**
- Modify: the dashboard nav/sidebar component (find with `grep -rln "/outreach" src/app src/components | grep -vi email-queue`)

- [ ] **Step 1: Find the nav**

Run: `cd ~/cp-emailqueue && grep -rln "href=\"/outreach\"\|'/outreach'" src/components src/app`
Identify the sidebar/nav file that lists `/outreach`.

- [ ] **Step 2: Add a link** to `/outreach/email-queue` labeled "Email Queue" immediately under the existing Outreach link, matching the surrounding link markup exactly (same classes/icon pattern).

- [ ] **Step 3: Typecheck + commit**

```bash
cd ~/cp-emailqueue && npx tsc --noEmit -p tsconfig.json
git add -A && git commit -m "feat(outreach): nav link to Email Queue"
```

---

## Task 9: Env + cron wiring (deploy-time, documented)

**Files:**
- Modify: `docs/superpowers/plans/2026-06-26-outreach-email-queue-sender.md` (this file already documents it — no code)

- [ ] **Step 1: Server `.env`** at `/var/www/commandpost/.env` add:
```
OUTREACH_SMTP_USER=phil@rekindleleads.com
OUTREACH_SMTP_PASS=<16-char Gmail App Password, no spaces>
OUTREACH_SMTP_FROM=Phil Smith <phil@rekindleleads.com>
OUTREACH_CRON_SECRET=<random 32+ char string>
```

- [ ] **Step 2: Crontab** on the Droplet (sends are self-throttled by the endpoint; firing every 30 min on weekday business hours yields ~10-15/day):
```
*/30 13-22 * * 1-5 curl -s -X POST http://localhost:3004/api/outreach/send-tick -H "x-cron-secret: <same secret>" >/dev/null 2>&1
```
(13–22 UTC ≈ 8am–5pm Central across DST; the endpoint itself enforces 9–5 Central, so over-firing is harmless.)

- [ ] **Step 3:** Deploy via `./scripts/deploy.sh`, then verify with one manual tick:
```
curl -s -X POST https://commandpost.rekindleleads.com/api/outreach/send-tick -H "x-cron-secret: <secret>"
```
Expected JSON like `{"sent":false,"reason":"empty"}` when the queue is empty, or `{"sent":true,"leadId":N}` when something is queued and within hours.

---

## Self-Review

- **Spec coverage:** states/migration → T1; pure logic → T2; transitions/queries → T3; throttled sender + guards + transport → T4; review/queue/sent UI → T7; queue API → T5; secret send endpoint → T6; nav → T8; env/cron/compliance prereqs → T9. CAN-SPAM lines already in drafts (no task needed). Manual opt-out → `do-not-email` action (T3/T5/T7). ✓ all spec sections mapped.
- **Placeholders:** none — every code step has full code; the only intentionally-deferred lookup is the nav file path (T8 step 1 gives the exact grep).
- **Type consistency:** `EMAIL_STATUS`, `isSendable`/`SendableLead`, `QueueLead`, `Tab`, `sendOneTick`/`TickResult`, `buildTransport`/`Transport` names are consistent across T2–T7. `email_sent_at_q` used consistently (distinct from the derived `email_sent_at` alias). ✓
