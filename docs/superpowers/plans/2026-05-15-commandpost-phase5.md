# Phase 5: SMS Alerts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Twilio SMS alerts for server incidents (immediate), daily morning briefings, Monday pipeline summaries, and 1st-of-month financial summaries.

**Architecture:** Twilio utility (`src/lib/twilio.ts`) gated behind env vars, same pattern as Stripe. Alert logging via `alerts_sent` table for dedup and audit. Immediate server alerts baked into the existing health check cron. Morning briefing as a new `scripts/sms-alerts.ts` script run at 7 AM Central via cron.

**Tech Stack:** Next.js 16, better-sqlite3, Node built-in `fetch` (Twilio REST API), Vitest

---

### Task 1: Schema & Types

**Files:**
- Modify: `src/lib/db.ts:158` (add alerts_sent table before closing backtick)
- Modify: `src/lib/types.ts` (add AlertSent interface and AlertType type)
- Modify: `tests/lib/db.test.ts` (add table existence assertion)

- [ ] **Step 1: Add the alerts_sent table to `src/lib/db.ts`**

Add after the incidents table (before the closing `` `); ``):

```sql
    CREATE TABLE IF NOT EXISTS alerts_sent (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_type TEXT NOT NULL,
      reference_id INTEGER,
      message TEXT NOT NULL,
      sent_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
```

- [ ] **Step 2: Add types to `src/lib/types.ts`**

Append to the file:

```typescript
export type AlertType = 'server_down' | 'server_recovered' | 'morning_briefing';

export interface AlertSent {
  id: number;
  alert_type: AlertType;
  reference_id: number | null;
  message: string;
  sent_at: string;
}
```

- [ ] **Step 3: Update db test**

In `tests/lib/db.test.ts`, inside the `'creates all required tables'` test, add after the `incidents` assertion:

```typescript
    expect(tables).toContain('alerts_sent');
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts src/lib/types.ts tests/lib/db.test.ts
git commit -m "feat(sms): add alerts_sent table and AlertSent type"
```

---

### Task 2: Twilio Utility

**Files:**
- Create: `src/lib/twilio.ts`
- Create: `tests/lib/twilio.test.ts`

- [ ] **Step 1: Write test file `tests/lib/twilio.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('twilio utility', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('isTwilioConfigured returns false when env vars missing', async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;
    delete process.env.ALERT_TO_NUMBER;
    const { isTwilioConfigured } = await import('@/lib/twilio');
    expect(isTwilioConfigured()).toBe(false);
  });

  it('isTwilioConfigured returns true when all env vars set', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC_test';
    process.env.TWILIO_AUTH_TOKEN = 'token_test';
    process.env.TWILIO_FROM_NUMBER = '+15551234567';
    process.env.ALERT_TO_NUMBER = '+15559876543';
    const { isTwilioConfigured } = await import('@/lib/twilio');
    expect(isTwilioConfigured()).toBe(true);
  });

  it('sendSms calls Twilio API with correct params', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC_test';
    process.env.TWILIO_AUTH_TOKEN = 'token_test';
    process.env.TWILIO_FROM_NUMBER = '+15551234567';
    process.env.ALERT_TO_NUMBER = '+15559876543';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sid: 'SM_test' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { sendSms } = await import('@/lib/twilio');
    const result = await sendSms('Test alert message');

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.twilio.com/2010-04-01/Accounts/AC_test/Messages.json');
    expect(options.method).toBe('POST');
    expect(options.headers['Authorization']).toContain('Basic');
    expect(options.body.toString()).toContain('Test+alert+message');

    vi.unstubAllGlobals();
  });

  it('sendSms returns false on API failure', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC_test';
    process.env.TWILIO_AUTH_TOKEN = 'token_test';
    process.env.TWILIO_FROM_NUMBER = '+15551234567';
    process.env.ALERT_TO_NUMBER = '+15559876543';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { sendSms } = await import('@/lib/twilio');
    const result = await sendSms('Test message');

    expect(result).toBe(false);

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/twilio.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/lib/twilio.ts`**

```typescript
export function isTwilioConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER &&
    process.env.ALERT_TO_NUMBER
  );
}

export async function sendSms(message: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_FROM_NUMBER!;
  const to = process.env.ALERT_TO_NUMBER!;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');

  const body = new URLSearchParams({ From: from, To: to, Body: message });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Twilio API error (${response.status}): ${text}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Twilio request failed:', err);
    return false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/twilio.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/twilio.ts tests/lib/twilio.test.ts
git commit -m "feat(sms): add Twilio utility with env gating and sendSms"
```

---

### Task 3: Alert Queries

**Files:**
- Create: `src/lib/queries/alert-queries.ts`
- Create: `tests/queries/alert-queries.test.ts`

- [ ] **Step 1: Write test file `tests/queries/alert-queries.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initDb } from '@/lib/db';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-alerts.db');

describe('alert queries', () => {
  let db: Database.Database;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    db = initDb(TEST_DB_PATH);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('records an alert', async () => {
    const { recordAlert, listRecentAlerts } = await import('@/lib/queries/alert-queries');
    recordAlert(db, { alert_type: 'server_down', reference_id: 42, message: 'ALERT: Test is down' });
    const alerts = listRecentAlerts(db, 10);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].alert_type).toBe('server_down');
    expect(alerts[0].reference_id).toBe(42);
    expect(alerts[0].message).toBe('ALERT: Test is down');
  });

  it('detects duplicate alerts by type and reference_id', async () => {
    const { recordAlert, hasAlertBeenSent } = await import('@/lib/queries/alert-queries');
    expect(hasAlertBeenSent(db, 'server_down', 42)).toBe(false);
    recordAlert(db, { alert_type: 'server_down', reference_id: 42, message: 'ALERT: Test is down' });
    expect(hasAlertBeenSent(db, 'server_down', 42)).toBe(true);
    expect(hasAlertBeenSent(db, 'server_down', 99)).toBe(false);
    expect(hasAlertBeenSent(db, 'server_recovered', 42)).toBe(false);
  });

  it('records alerts without reference_id', async () => {
    const { recordAlert, listRecentAlerts } = await import('@/lib/queries/alert-queries');
    recordAlert(db, { alert_type: 'morning_briefing', reference_id: null, message: 'Good morning.' });
    const alerts = listRecentAlerts(db, 10);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].reference_id).toBeNull();
  });

  it('lists recent alerts in descending order', async () => {
    const { recordAlert, listRecentAlerts } = await import('@/lib/queries/alert-queries');
    recordAlert(db, { alert_type: 'server_down', reference_id: 1, message: 'First' });
    recordAlert(db, { alert_type: 'server_recovered', reference_id: 1, message: 'Second' });
    const alerts = listRecentAlerts(db, 10);
    expect(alerts).toHaveLength(2);
    expect(alerts[0].message).toBe('Second'); // newest first
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/queries/alert-queries.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/lib/queries/alert-queries.ts`**

```typescript
import type Database from 'better-sqlite3';
import type { AlertSent, AlertType } from '@/lib/types';

interface RecordAlertInput {
  alert_type: AlertType;
  reference_id: number | null;
  message: string;
}

export function recordAlert(db: Database.Database, input: RecordAlertInput): number {
  const result = db.prepare(
    `INSERT INTO alerts_sent (alert_type, reference_id, message) VALUES (?, ?, ?)`
  ).run(input.alert_type, input.reference_id, input.message);
  return Number(result.lastInsertRowid);
}

export function hasAlertBeenSent(db: Database.Database, alertType: AlertType, referenceId: number): boolean {
  const row = db.prepare(
    'SELECT id FROM alerts_sent WHERE alert_type = ? AND reference_id = ? LIMIT 1'
  ).get(alertType, referenceId);
  return !!row;
}

export function listRecentAlerts(db: Database.Database, limit: number): AlertSent[] {
  return db.prepare(
    'SELECT * FROM alerts_sent ORDER BY sent_at DESC, id DESC LIMIT ?'
  ).all(limit) as AlertSent[];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/queries/alert-queries.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/alert-queries.ts tests/queries/alert-queries.test.ts
git commit -m "feat(sms): add alert recording, dedup, and listing queries with tests"
```

---

### Task 4: Integrate Immediate Alerts into Health Check Script

**Files:**
- Modify: `scripts/health-check.ts`

- [ ] **Step 1: Update imports at top of `scripts/health-check.ts`**

Add after the existing imports:

```typescript
import { isTwilioConfigured, sendSms } from '../src/lib/twilio';
import { recordAlert, hasAlertBeenSent } from '../src/lib/queries/alert-queries';
```

- [ ] **Step 2: Add SMS alert after incident creation**

Replace the block:
```typescript
          createIncident(db, ep.id);
          console.log(`  INCIDENT CREATED for ${ep.name}`);
```

With:
```typescript
          const incidentId = createIncident(db, ep.id);
          console.log(`  INCIDENT CREATED for ${ep.name}`);

          // Send SMS alert
          if (isTwilioConfigured() && !hasAlertBeenSent(db, 'server_down', incidentId)) {
            const lastHealthy = last ? last.checked_at : 'unknown';
            const message = `ALERT: ${ep.name} is down. Last healthy: ${lastHealthy}`;
            const sent = await sendSms(message);
            if (sent) {
              recordAlert(db, { alert_type: 'server_down', reference_id: incidentId, message });
              console.log(`  SMS SENT: ${message}`);
            }
          }
```

- [ ] **Step 3: Add SMS alert after incident resolution**

Replace the block:
```typescript
        resolveIncident(db, openIncident.id);
        console.log(`  INCIDENT RESOLVED for ${ep.name}`);
```

With:
```typescript
        resolveIncident(db, openIncident.id);
        console.log(`  INCIDENT RESOLVED for ${ep.name}`);

        // Send recovery SMS
        if (isTwilioConfigured()) {
          const duration = formatDuration(openIncident);
          const message = `RECOVERED: ${ep.name} is back up. Downtime: ${duration}`;
          const sent = await sendSms(message);
          if (sent) {
            recordAlert(db, { alert_type: 'server_recovered', reference_id: openIncident.id, message });
            console.log(`  SMS SENT: ${message}`);
          }
        }
```

- [ ] **Step 4: Add `formatDuration` helper at end of file (before `main()` call)**

```typescript
function formatDuration(incident: { started_at: string }): string {
  const startMs = new Date(incident.started_at + 'Z').getTime();
  const seconds = Math.floor((Date.now() - startMs) / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}
```

- [ ] **Step 5: Also update the `createIncident` call to capture the returned id**

Note: `createIncident` already returns `number` (the incident id). The existing code calls `createIncident(db, ep.id)` without capturing the return value. Step 2 above replaces it with `const incidentId = createIncident(db, ep.id)`.

- [ ] **Step 6: Verify build and test**

Run: `npm test && npx next build`
Expected: All tests pass, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add scripts/health-check.ts
git commit -m "feat(sms): add immediate SMS alerts for server down/recovered"
```

---

### Task 5: Morning Briefing Script

**Files:**
- Create: `scripts/sms-alerts.ts`
- Modify: `package.json` (add npm script)

- [ ] **Step 1: Write `scripts/sms-alerts.ts`**

```typescript
import { initDb } from '../src/lib/db';
import { isTwilioConfigured, sendSms } from '../src/lib/twilio';
import { recordAlert } from '../src/lib/queries/alert-queries';
import { getActionItems, getDashboardSummary } from '../src/lib/queries/dashboard-queries';
import { getYtdStats } from '../src/lib/queries/finance-queries';

function getLastMonthStats(db: ReturnType<typeof initDb>): { revenue: number; expenses: number; profit: number; outstanding: number } {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const ym = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;

  const revenue = (db.prepare(
    "SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'paid' AND strftime('%Y-%m', paid_at) = ?"
  ).get(ym) as any).total;

  const expenses = (db.prepare(
    "SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE strftime('%Y-%m', expense_date) = ?"
  ).get(ym) as any).total;

  const outstanding = (db.prepare(
    "SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'sent'"
  ).get() as any).total;

  return { revenue, expenses, profit: revenue - expenses, outstanding };
}

async function morningBriefing() {
  if (!isTwilioConfigured()) {
    console.log('Twilio not configured. Skipping morning briefing.');
    return;
  }

  const db = initDb();
  const actionItems = getActionItems(db);
  const summary = getDashboardSummary(db);

  const now = new Date();
  const isCentral = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'long' });
  const dayOfWeek = isCentral.format(now);
  const isMonday = dayOfWeek === 'Monday';

  const centralDate = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', day: 'numeric' });
  const dayOfMonth = parseInt(centralDate.format(now), 10);
  const isFirstOfMonth = dayOfMonth === 1;

  const parts: string[] = [];

  // Action items
  if (actionItems.length > 0) {
    const itemLines = actionItems.slice(0, 8).map((item, i) => `(${i + 1}) ${item.title}`);
    parts.push(`${actionItems.length} items need attention: ${itemLines.join(' ')}`);
  }

  // Monday pipeline summary
  if (isMonday) {
    parts.push(`Pipeline: ${summary.pipelineLeads} leads worth $${summary.pipelineValue.toLocaleString()}, ${summary.needsFollowUp} need follow-up`);
  }

  // 1st of month financial summary
  if (isFirstOfMonth) {
    const lastMonth = getLastMonthStats(db);
    parts.push(`Last month: $${lastMonth.revenue.toLocaleString()} revenue, $${lastMonth.expenses.toLocaleString()} expenses, $${lastMonth.profit.toLocaleString()} profit. $${lastMonth.outstanding.toLocaleString()} outstanding`);
  }

  if (parts.length === 0) {
    console.log('Nothing to report. Skipping morning briefing.');
    db.close();
    return;
  }

  const message = `Good morning. ${parts.join('. ')}. Open CommandPost for details.`;

  console.log(`Sending morning briefing: ${message}`);
  const sent = await sendSms(message);

  if (sent) {
    recordAlert(db, { alert_type: 'morning_briefing', reference_id: null, message });
    console.log('Morning briefing sent.');
  } else {
    console.error('Failed to send morning briefing.');
  }

  db.close();
}

const args = process.argv.slice(2);

if (args.includes('--morning')) {
  morningBriefing().catch((err) => {
    console.error('Morning briefing failed:', err);
    process.exit(1);
  });
} else {
  console.log('Usage: npx tsx scripts/sms-alerts.ts --morning');
  process.exit(1);
}
```

- [ ] **Step 2: Add npm script to `package.json`**

Add to the `"scripts"` section:

```json
"cron:alerts": "npx tsx scripts/sms-alerts.ts --morning"
```

- [ ] **Step 3: Test the script runs without Twilio configured**

Run: `npx tsx scripts/sms-alerts.ts --morning`
Expected: Outputs "Twilio not configured. Skipping morning briefing." and exits cleanly.

- [ ] **Step 4: Test without --morning flag**

Run: `npx tsx scripts/sms-alerts.ts`
Expected: Outputs "Usage: npx tsx scripts/sms-alerts.ts --morning" and exits with code 1.

- [ ] **Step 5: Commit**

```bash
git add scripts/sms-alerts.ts package.json
git commit -m "feat(sms): add morning briefing script with pipeline and financial summaries"
```

---

### Task 6: Final Verification

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass (should be ~67+ tests).

- [ ] **Step 2: Run production build**

Run: `npx next build`
Expected: Clean build.

- [ ] **Step 3: Run health check script**

Run: `npx tsx scripts/health-check.ts`
Expected: Health checks run. No SMS sent (Twilio not configured). No errors.

- [ ] **Step 4: Run morning briefing script**

Run: `npx tsx scripts/sms-alerts.ts --morning`
Expected: "Twilio not configured. Skipping morning briefing."

- [ ] **Step 5: Commit any fixes**

If any fixes were needed during verification, commit them.

```bash
git add -A
git commit -m "fix(sms): final verification fixes for Phase 5"
```
