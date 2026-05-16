# CommandPost Phase 6: Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve mobile usability with targeted CSS fixes and add a disk monitoring agent that accepts reports from remote servers and alerts via SMS.

**Architecture:** Two independent parts. Part 1 is CSS-only changes across 20 page files plus one component. Part 2 adds a `disk_reports` table, query layer, API endpoint, UI component, bash agent script, and morning briefing integration. Follows existing patterns — SQLite, server actions, Twilio SMS gating.

**Tech Stack:** Next.js 16, better-sqlite3, Tailwind CSS v4, Vitest, bash/curl for the agent script.

---

## File Structure

```
src/
  lib/
    db.ts                                    # MODIFY: add disk_reports table
    types.ts                                 # MODIFY: add disk_warning to AlertType, DiskReport interface
    queries/
      alert-queries.ts                       # MODIFY: add hasAlertBeenSentToday function
      disk-report-queries.ts                 # CREATE: recordDiskReport, getLatestDiskReports, deleteOldDiskReports
  app/
    api/
      disk-report/
        route.ts                             # CREATE: POST handler
    (dashboard)/
      page.tsx                               # MODIFY: padding + grid
      clients/ (6 pages)                     # MODIFY: padding only
      pipeline/ (4 pages)                    # MODIFY: padding only
      finances/ (4 pages)                    # MODIFY: padding only
      ops/ (4 pages)                         # MODIFY: padding + ops detail extras
  components/
    kanban-board.tsx                          # MODIFY: scroll hint
    disk-usage-bar.tsx                        # CREATE
scripts/
  sms-alerts.ts                              # MODIFY: disk warnings in morning briefing
  disk-report.sh                             # CREATE
tests/
  queries/
    disk-report-queries.test.ts              # CREATE
```

---

### Task 1: Mobile padding fix — all 20 pages

**Files:**
- Modify: `src/app/(dashboard)/page.tsx:18`
- Modify: `src/app/(dashboard)/clients/page.tsx:33`
- Modify: `src/app/(dashboard)/clients/new/page.tsx:7`
- Modify: `src/app/(dashboard)/clients/[id]/page.tsx:33`
- Modify: `src/app/(dashboard)/clients/[id]/edit/page.tsx:22`
- Modify: `src/app/(dashboard)/clients/[id]/projects/new/page.tsx:22`
- Modify: `src/app/(dashboard)/clients/[id]/projects/[projectId]/page.tsx:40`
- Modify: `src/app/(dashboard)/clients/[id]/projects/[projectId]/edit/page.tsx:24`
- Modify: `src/app/(dashboard)/pipeline/page.tsx:24`
- Modify: `src/app/(dashboard)/pipeline/new/page.tsx:7`
- Modify: `src/app/(dashboard)/pipeline/[id]/page.tsx:30`
- Modify: `src/app/(dashboard)/pipeline/[id]/edit/page.tsx:19`
- Modify: `src/app/(dashboard)/finances/page.tsx:24`
- Modify: `src/app/(dashboard)/finances/invoices/new/page.tsx:12`
- Modify: `src/app/(dashboard)/finances/invoices/[id]/page.tsx:29`
- Modify: `src/app/(dashboard)/finances/invoices/[id]/edit/page.tsx:23`
- Modify: `src/app/(dashboard)/ops/page.tsx:33`
- Modify: `src/app/(dashboard)/ops/new/page.tsx:6`
- Modify: `src/app/(dashboard)/ops/[id]/page.tsx:37`
- Modify: `src/app/(dashboard)/ops/[id]/edit/page.tsx:17`

- [ ] **Step 1: Update padding on all 20 pages**

For each page listed above, change `p-6` to `p-4 sm:p-6` in the outermost `<div>` wrapper.

Some pages have `className="p-6"`, others have `className="p-6 bg-gray-950 min-h-screen"`. In all cases, replace the `p-6` portion with `p-4 sm:p-6`, keeping any additional classes.

Examples:
- `className="p-6"` becomes `className="p-4 sm:p-6"`
- `className="p-6 bg-gray-950 min-h-screen"` becomes `className="p-4 sm:p-6 bg-gray-950 min-h-screen"`

- [ ] **Step 2: Verify the build compiles**

Run: `cd /Users/philipsmith/commandpost && npm run build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app
git commit -m "style: reduce page padding on mobile (p-4 sm:p-6)"
```

---

### Task 2: Dashboard grid fix + ops detail mobile improvements

**Files:**
- Modify: `src/app/(dashboard)/page.tsx:27`
- Modify: `src/app/(dashboard)/ops/[id]/page.tsx:42-46,62`

- [ ] **Step 1: Fix dashboard summary cards grid**

In `src/app/(dashboard)/page.tsx`, change:
```tsx
<div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
```
to:
```tsx
<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-8">
```

- [ ] **Step 2: Fix endpoint detail header wrapping**

In `src/app/(dashboard)/ops/[id]/page.tsx`, the header section is:
```tsx
<div className="flex items-center gap-3 mb-6">
  <StatusDot color={color} />
  <h2 className="text-2xl font-bold">{endpoint.name}</h2>
  <span className="text-sm text-gray-400 font-mono">{endpoint.url}</span>
</div>
```

Change to:
```tsx
<div className="flex flex-wrap items-center gap-3 mb-6">
  <StatusDot color={color} />
  <h2 className="text-2xl font-bold">{endpoint.name}</h2>
  <span className="text-sm text-gray-400 font-mono break-all">{endpoint.url}</span>
</div>
```

- [ ] **Step 3: Fix ops detail stats cards grid**

In `src/app/(dashboard)/ops/[id]/page.tsx`, change:
```tsx
<div className="grid grid-cols-3 gap-4 mb-8">
```
to:
```tsx
<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
```

- [ ] **Step 4: Verify the build compiles**

Run: `cd /Users/philipsmith/commandpost && npm run build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app
git commit -m "style: improve dashboard grid and ops detail layout for mobile"
```

---

### Task 3: Kanban scroll hint

**Files:**
- Modify: `src/components/kanban-board.tsx:53-54`

- [ ] **Step 1: Add scroll hint gradient wrapper**

In `src/components/kanban-board.tsx`, wrap the existing board `<div>` in a container with a right-edge gradient fade on small screens.

Replace:
```tsx
return (
    <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '70vh' }}>
```

With:
```tsx
return (
    <div className="relative">
      <div className="sm:hidden absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-gray-950 to-transparent pointer-events-none z-10" />
      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '70vh' }}>
```

And add a matching closing `</div>` at the end of the return. The existing closing `</div>` for the flex container stays. Add a new `</div>` after it for the relative wrapper:

Replace:
```tsx
    </div>
  );
```

With:
```tsx
      </div>
    </div>
  );
```

- [ ] **Step 2: Verify the build compiles**

Run: `cd /Users/philipsmith/commandpost && npm run build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/kanban-board.tsx
git commit -m "style: add scroll hint gradient to kanban board on mobile"
```

---

### Task 4: Database schema + types for disk monitoring

**Files:**
- Modify: `src/lib/db.ts:160-167` (after alerts_sent table)
- Modify: `src/lib/types.ts:153,155-161`

- [ ] **Step 1: Add disk_reports table to db.ts**

In `src/lib/db.ts`, add the following table creation after the `alerts_sent` table block (before the closing `\`);`):

```sql
CREATE TABLE IF NOT EXISTS disk_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint_id INTEGER NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
  mount_point TEXT NOT NULL,
  total_gb REAL NOT NULL,
  used_gb REAL NOT NULL,
  percent_used REAL NOT NULL,
  reported_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- [ ] **Step 2: Add DiskReport interface and update AlertType in types.ts**

In `src/lib/types.ts`, change:
```typescript
export type AlertType = 'server_down' | 'server_recovered' | 'morning_briefing';
```
to:
```typescript
export type AlertType = 'server_down' | 'server_recovered' | 'morning_briefing' | 'disk_warning';
```

Add after the `AlertSent` interface:
```typescript
export interface DiskReport {
  id: number;
  endpoint_id: number;
  mount_point: string;
  total_gb: number;
  used_gb: number;
  percent_used: number;
  reported_at: string;
}
```

- [ ] **Step 3: Verify the build compiles**

Run: `cd /Users/philipsmith/commandpost && npm run build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 4: Run existing tests to check nothing breaks**

Run: `cd /Users/philipsmith/commandpost && npm test 2>&1 | tail -20`
Expected: All 67 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts src/lib/types.ts
git commit -m "feat: add disk_reports table and DiskReport type"
```

---

### Task 5: Disk report queries + tests

**Files:**
- Create: `src/lib/queries/disk-report-queries.ts`
- Modify: `src/lib/queries/alert-queries.ts`
- Create: `tests/queries/disk-report-queries.test.ts`

- [ ] **Step 1: Write disk report query tests**

Create `tests/queries/disk-report-queries.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initDb } from '@/lib/db';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-disk-reports.db');

describe('disk report queries', () => {
  let db: Database.Database;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    db = initDb(TEST_DB_PATH);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('records and retrieves disk reports', async () => {
    const { createEndpoint } = await import('@/lib/queries/endpoint-queries');
    const { recordDiskReport, getLatestDiskReports } = await import('@/lib/queries/disk-report-queries');

    const epId = createEndpoint(db, { name: 'test-server', url: 'https://test.com', check_interval_seconds: 300, slow_threshold_ms: 5000, is_active: 1 });
    recordDiskReport(db, { endpoint_id: epId, mount_point: '/', total_gb: 50, used_gb: 42, percent_used: 84.0 });
    recordDiskReport(db, { endpoint_id: epId, mount_point: '/data', total_gb: 200, used_gb: 185, percent_used: 92.5 });

    const reports = getLatestDiskReports(db, epId);
    expect(reports).toHaveLength(2);
    expect(reports.find(r => r.mount_point === '/')!.percent_used).toBe(84.0);
    expect(reports.find(r => r.mount_point === '/data')!.percent_used).toBe(92.5);
  });

  it('returns only the latest report per mount point', async () => {
    const { createEndpoint } = await import('@/lib/queries/endpoint-queries');
    const { recordDiskReport, getLatestDiskReports } = await import('@/lib/queries/disk-report-queries');

    const epId = createEndpoint(db, { name: 'test-server', url: 'https://test.com', check_interval_seconds: 300, slow_threshold_ms: 5000, is_active: 1 });

    // Old report
    db.prepare("INSERT INTO disk_reports (endpoint_id, mount_point, total_gb, used_gb, percent_used, reported_at) VALUES (?, ?, ?, ?, ?, datetime('now', '-1 hour'))").run(epId, '/', 50, 30, 60.0);
    // New report
    recordDiskReport(db, { endpoint_id: epId, mount_point: '/', total_gb: 50, used_gb: 42, percent_used: 84.0 });

    const reports = getLatestDiskReports(db, epId);
    expect(reports).toHaveLength(1);
    expect(reports[0].percent_used).toBe(84.0);
  });

  it('deletes old disk reports', async () => {
    const { createEndpoint } = await import('@/lib/queries/endpoint-queries');
    const { deleteOldDiskReports } = await import('@/lib/queries/disk-report-queries');

    const epId = createEndpoint(db, { name: 'test-server', url: 'https://test.com', check_interval_seconds: 300, slow_threshold_ms: 5000, is_active: 1 });

    // Insert old report (31 days ago)
    db.prepare("INSERT INTO disk_reports (endpoint_id, mount_point, total_gb, used_gb, percent_used, reported_at) VALUES (?, ?, ?, ?, ?, datetime('now', '-31 days'))").run(epId, '/', 50, 42, 84.0);
    // Insert recent report
    db.prepare("INSERT INTO disk_reports (endpoint_id, mount_point, total_gb, used_gb, percent_used) VALUES (?, ?, ?, ?, ?)").run(epId, '/', 50, 42, 84.0);

    const deleted = deleteOldDiskReports(db);
    expect(deleted).toBe(1);

    const remaining = db.prepare('SELECT COUNT(*) as count FROM disk_reports').get() as any;
    expect(remaining.count).toBe(1);
  });

  it('gets all critical disk reports across endpoints', async () => {
    const { createEndpoint } = await import('@/lib/queries/endpoint-queries');
    const { recordDiskReport, getCriticalDiskReports } = await import('@/lib/queries/disk-report-queries');

    const ep1 = createEndpoint(db, { name: 'server-1', url: 'https://s1.com', check_interval_seconds: 300, slow_threshold_ms: 5000, is_active: 1 });
    const ep2 = createEndpoint(db, { name: 'server-2', url: 'https://s2.com', check_interval_seconds: 300, slow_threshold_ms: 5000, is_active: 1 });

    recordDiskReport(db, { endpoint_id: ep1, mount_point: '/', total_gb: 50, used_gb: 45, percent_used: 90.0 });
    recordDiskReport(db, { endpoint_id: ep2, mount_point: '/', total_gb: 100, used_gb: 50, percent_used: 50.0 });

    const critical = getCriticalDiskReports(db);
    expect(critical).toHaveLength(1);
    expect(critical[0].endpoint_name).toBe('server-1');
    expect(critical[0].percent_used).toBe(90.0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/philipsmith/commandpost && npx vitest run tests/queries/disk-report-queries.test.ts 2>&1 | tail -10`
Expected: FAIL — module not found.

- [ ] **Step 3: Add hasAlertBeenSentToday to alert-queries.ts**

In `src/lib/queries/alert-queries.ts`, add after the `hasAlertBeenSent` function:

```typescript
export function hasAlertBeenSentToday(db: Database.Database, alertType: AlertType, referenceId: number): boolean {
  const row = db.prepare(
    "SELECT id FROM alerts_sent WHERE alert_type = ? AND reference_id = ? AND sent_at >= date('now') LIMIT 1"
  ).get(alertType, referenceId);
  return !!row;
}
```

- [ ] **Step 4: Create disk-report-queries.ts**

Create `src/lib/queries/disk-report-queries.ts`:

```typescript
import type Database from 'better-sqlite3';
import type { DiskReport } from '@/lib/types';

interface RecordDiskReportInput {
  endpoint_id: number;
  mount_point: string;
  total_gb: number;
  used_gb: number;
  percent_used: number;
}

export function recordDiskReport(db: Database.Database, input: RecordDiskReportInput): number {
  const result = db.prepare(
    'INSERT INTO disk_reports (endpoint_id, mount_point, total_gb, used_gb, percent_used) VALUES (?, ?, ?, ?, ?)'
  ).run(input.endpoint_id, input.mount_point, input.total_gb, input.used_gb, input.percent_used);
  return Number(result.lastInsertRowid);
}

export function getLatestDiskReports(db: Database.Database, endpointId: number): DiskReport[] {
  return db.prepare(`
    SELECT dr.* FROM disk_reports dr
    INNER JOIN (
      SELECT endpoint_id, mount_point, MAX(reported_at) as max_reported
      FROM disk_reports
      WHERE endpoint_id = ?
      GROUP BY endpoint_id, mount_point
    ) latest ON dr.endpoint_id = latest.endpoint_id
      AND dr.mount_point = latest.mount_point
      AND dr.reported_at = latest.max_reported
    ORDER BY dr.mount_point ASC
  `).all(endpointId) as DiskReport[];
}

export interface CriticalDiskReport {
  endpoint_id: number;
  endpoint_name: string;
  mount_point: string;
  total_gb: number;
  used_gb: number;
  percent_used: number;
  reported_at: string;
}

export function getCriticalDiskReports(db: Database.Database): CriticalDiskReport[] {
  return db.prepare(`
    SELECT dr.endpoint_id, e.name as endpoint_name, dr.mount_point,
           dr.total_gb, dr.used_gb, dr.percent_used, dr.reported_at
    FROM disk_reports dr
    INNER JOIN (
      SELECT endpoint_id, mount_point, MAX(reported_at) as max_reported
      FROM disk_reports
      GROUP BY endpoint_id, mount_point
    ) latest ON dr.endpoint_id = latest.endpoint_id
      AND dr.mount_point = latest.mount_point
      AND dr.reported_at = latest.max_reported
    INNER JOIN endpoints e ON dr.endpoint_id = e.id
    WHERE dr.percent_used >= 85
    ORDER BY dr.percent_used DESC
  `).all() as CriticalDiskReport[];
}

export function deleteOldDiskReports(db: Database.Database): number {
  const result = db.prepare(
    "DELETE FROM disk_reports WHERE reported_at < datetime('now', '-30 days')"
  ).run();
  return result.changes;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/philipsmith/commandpost && npx vitest run tests/queries/disk-report-queries.test.ts 2>&1 | tail -10`
Expected: All 4 tests pass.

- [ ] **Step 6: Run full test suite**

Run: `cd /Users/philipsmith/commandpost && npm test 2>&1 | tail -10`
Expected: All tests pass (67 existing + 4 new = 71).

- [ ] **Step 7: Commit**

```bash
git add src/lib/queries/disk-report-queries.ts src/lib/queries/alert-queries.ts tests/queries/disk-report-queries.test.ts
git commit -m "feat: add disk report queries with tests and hasAlertBeenSentToday"
```

---

### Task 6: Disk report API endpoint

**Files:**
- Create: `src/app/api/disk-report/route.ts`

- [ ] **Step 1: Create the API route**

Create `src/app/api/disk-report/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { recordDiskReport, deleteOldDiskReports } from '@/lib/queries/disk-report-queries';
import { hasAlertBeenSentToday, recordAlert } from '@/lib/queries/alert-queries';
import { isTwilioConfigured, sendSms } from '@/lib/twilio';

export async function POST(request: NextRequest) {
  const apiKey = process.env.DISK_REPORT_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Disk reporting not configured' }, { status: 503 });
  }

  const key = request.nextUrl.searchParams.get('key');
  if (key !== apiKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { endpoint_name: string; disks: { mount: string; total_gb: number; used_gb: number; percent_used: number }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.endpoint_name || !Array.isArray(body.disks) || body.disks.length === 0) {
    return NextResponse.json({ error: 'Missing endpoint_name or disks' }, { status: 400 });
  }

  const db = getDb();

  const endpoint = db.prepare('SELECT id, name FROM endpoints WHERE name = ?').get(body.endpoint_name) as { id: number; name: string } | undefined;
  if (!endpoint) {
    return NextResponse.json({ error: `Endpoint not found: ${body.endpoint_name}` }, { status: 404 });
  }

  for (const disk of body.disks) {
    recordDiskReport(db, {
      endpoint_id: endpoint.id,
      mount_point: disk.mount,
      total_gb: disk.total_gb,
      used_gb: disk.used_gb,
      percent_used: disk.percent_used,
    });

    if (disk.percent_used >= 85 && isTwilioConfigured()) {
      if (!hasAlertBeenSentToday(db, 'disk_warning', endpoint.id)) {
        const message = `DISK WARNING: ${endpoint.name} ${disk.mount} at ${disk.percent_used.toFixed(1)}% (${disk.used_gb.toFixed(1)}GB / ${disk.total_gb.toFixed(1)}GB)`;
        const sent = await sendSms(message);
        if (sent) {
          recordAlert(db, { alert_type: 'disk_warning', reference_id: endpoint.id, message });
        }
      }
    }
  }

  deleteOldDiskReports(db);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `cd /Users/philipsmith/commandpost && npm run build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/disk-report/route.ts
git commit -m "feat: add POST /api/disk-report endpoint with SMS alerting"
```

---

### Task 7: Disk usage bar component

**Files:**
- Create: `src/components/disk-usage-bar.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/disk-usage-bar.tsx`:

```tsx
import type { DiskReport } from '@/lib/types';

function barColor(percent: number): string {
  if (percent >= 85) return 'bg-red-500';
  if (percent >= 70) return 'bg-yellow-500';
  return 'bg-green-500';
}

export function DiskUsageBar({ report }: { report: DiskReport }) {
  return (
    <div className="p-3 bg-gray-900 border border-gray-800 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-white font-mono">{report.mount_point}</span>
        <span className="text-xs text-gray-400">
          {report.used_gb.toFixed(1)} / {report.total_gb.toFixed(1)} GB ({report.percent_used.toFixed(1)}%)
        </span>
      </div>
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor(report.percent_used)}`}
          style={{ width: `${Math.min(report.percent_used, 100)}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-1">
        Last reported: {new Date(report.reported_at + 'Z').toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `cd /Users/philipsmith/commandpost && npm run build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/disk-usage-bar.tsx
git commit -m "feat: add DiskUsageBar component"
```

---

### Task 8: Add disk usage section to ops detail page

**Files:**
- Modify: `src/app/(dashboard)/ops/[id]/page.tsx`

- [ ] **Step 1: Add disk usage section**

In `src/app/(dashboard)/ops/[id]/page.tsx`:

Add import at the top:
```typescript
import { getLatestDiskReports } from '@/lib/queries/disk-report-queries';
import { DiskUsageBar } from '@/components/disk-usage-bar';
```

After the existing data fetching (after `const incidents = listIncidents(db, endpoint.id);`), add:
```typescript
const diskReports = getLatestDiskReports(db, endpoint.id);
```

After the `<ResponseTimeChart checks={checks24h} />` line and before the `{/* Incident History */}` comment, add:
```tsx
{/* Disk Usage */}
{diskReports.length > 0 && (
  <div className="mb-8">
    <h3 className="text-lg font-semibold mb-3">Disk Usage</h3>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {diskReports.map((report) => (
        <DiskUsageBar key={report.id} report={report} />
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 2: Verify the build compiles**

Run: `cd /Users/philipsmith/commandpost && npm run build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/ops/\[id\]/page.tsx
git commit -m "feat: show disk usage on ops endpoint detail page"
```

---

### Task 9: Morning briefing disk warnings

**Files:**
- Modify: `scripts/sms-alerts.ts`

- [ ] **Step 1: Add disk warnings to morning briefing**

In `scripts/sms-alerts.ts`:

Add import at the top:
```typescript
import { getCriticalDiskReports } from '../src/lib/queries/disk-report-queries';
```

Inside the `morningBriefing` function, after the `if (isFirstOfMonth)` block and before the `if (parts.length === 0)` check, add:

```typescript
// Disk warnings
const criticalDisks = getCriticalDiskReports(db);
if (criticalDisks.length > 0) {
  const diskLines = criticalDisks.map(d => `${d.endpoint_name} ${d.mount_point} at ${d.percent_used.toFixed(0)}%`);
  parts.push(`Disk warnings: ${diskLines.join(', ')}`);
}
```

- [ ] **Step 2: Verify the script compiles**

Run: `cd /Users/philipsmith/commandpost && npx tsx --eval "import '../scripts/sms-alerts'" 2>&1 | head -5`
Expected: Shows "Usage: npx tsx scripts/sms-alerts.ts --morning" (script exits because no --morning flag, but it compiles).

- [ ] **Step 3: Commit**

```bash
git add scripts/sms-alerts.ts
git commit -m "feat: include disk warnings in morning briefing SMS"
```

---

### Task 10: Bash agent script

**Files:**
- Create: `scripts/disk-report.sh`

- [ ] **Step 1: Create the bash script**

Create `scripts/disk-report.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Usage: ./disk-report.sh <commandpost-url> <api-key> [hostname-override]
# Example: ./disk-report.sh https://commandpost.example.com my-secret-key
# Meant to run hourly via cron: 0 * * * * /path/to/disk-report.sh https://... key

if [ $# -lt 2 ]; then
  echo "Usage: $0 <commandpost-url> <api-key> [hostname]"
  exit 1
fi

URL="$1"
KEY="$2"
HOST="${3:-$(hostname)}"

# Build JSON array of disk entries from df, filtering to real filesystems
DISKS=$(df -B1 2>/dev/null | awk 'NR>1 && $1 ~ /^\/dev/ {
  total = $2 / 1073741824
  used = $3 / 1073741824
  pct = (used / total) * 100
  printf "{\"mount\":\"%s\",\"total_gb\":%.1f,\"used_gb\":%.1f,\"percent_used\":%.1f},", $6, total, used, pct
}')

# Remove trailing comma and wrap in array
DISKS="[${DISKS%,}]"

PAYLOAD="{\"endpoint_name\":\"${HOST}\",\"disks\":${DISKS}}"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "${URL}/api/disk-report?key=${KEY}" \
  -H "Content-Type: application/json" \
  -d "${PAYLOAD}")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -1)

if [ "$HTTP_CODE" -eq 200 ]; then
  echo "OK: Disk report sent for ${HOST}"
  exit 0
else
  echo "FAIL (HTTP ${HTTP_CODE}): ${BODY}"
  exit 1
fi
```

- [ ] **Step 2: Make it executable**

Run: `chmod +x /Users/philipsmith/commandpost/scripts/disk-report.sh`

- [ ] **Step 3: Commit**

```bash
git add scripts/disk-report.sh
git commit -m "feat: add bash disk report agent script"
```

---

### Task 11: Final verification

- [ ] **Step 1: Run full test suite**

Run: `cd /Users/philipsmith/commandpost && npm test 2>&1 | tail -20`
Expected: All tests pass (71 total: 67 existing + 4 new disk report tests).

- [ ] **Step 2: Run production build**

Run: `cd /Users/philipsmith/commandpost && npm run build 2>&1 | tail -10`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Verify all new files exist**

Run:
```bash
ls -la /Users/philipsmith/commandpost/src/lib/queries/disk-report-queries.ts \
  /Users/philipsmith/commandpost/src/app/api/disk-report/route.ts \
  /Users/philipsmith/commandpost/src/components/disk-usage-bar.tsx \
  /Users/philipsmith/commandpost/scripts/disk-report.sh \
  /Users/philipsmith/commandpost/tests/queries/disk-report-queries.test.ts
```
Expected: All 5 files exist.
