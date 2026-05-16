# Phase 4: Ops Monitor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add HTTP health checking of deployed apps/servers with cron-based monitoring, incident tracking, and a status dashboard.

**Architecture:** Three new DB tables (endpoints, health_checks, incidents). A cron script (`scripts/health-check.ts`) runs every minute via system cron, pings active endpoints, records results, detects downtime (2 consecutive failures), and resolves incidents on recovery. The `/ops` pages show status, detail, and management. Dashboard integrates server status via summary card and action items.

**Tech Stack:** Next.js 16, better-sqlite3, Node built-in `fetch`, Tailwind CSS v4, Vitest

---

### Task 1: Schema & Types

**Files:**
- Modify: `src/lib/db.ts:132` (add 3 tables before closing backtick)
- Modify: `src/lib/types.ts` (add 3 interfaces + types)
- Modify: `tests/lib/db.test.ts` (add table existence assertions)

- [ ] **Step 1: Add the 3 new tables to `src/lib/db.ts`**

Add before the closing `` `); `` on line 132:

```typescript
    CREATE TABLE IF NOT EXISTS endpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      check_interval_seconds INTEGER NOT NULL DEFAULT 300,
      slow_threshold_ms INTEGER NOT NULL DEFAULT 5000,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS health_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint_id INTEGER NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
      status_code INTEGER,
      response_time_ms INTEGER NOT NULL,
      is_healthy INTEGER NOT NULL,
      checked_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint_id INTEGER NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT,
      duration_seconds INTEGER
    );
```

- [ ] **Step 2: Add types to `src/lib/types.ts`**

Append to the file:

```typescript
export interface Endpoint {
  id: number;
  name: string;
  url: string;
  check_interval_seconds: number;
  slow_threshold_ms: number;
  is_active: number;
  created_at: string;
}

export interface HealthCheck {
  id: number;
  endpoint_id: number;
  status_code: number | null;
  response_time_ms: number;
  is_healthy: number;
  checked_at: string;
}

export interface Incident {
  id: number;
  endpoint_id: number;
  started_at: string;
  resolved_at: string | null;
  duration_seconds: number | null;
}
```

- [ ] **Step 3: Update db test to check new tables**

In `tests/lib/db.test.ts`, inside the `'creates all required tables'` test, add after the `expenses` assertion:

```typescript
    expect(tables).toContain('endpoints');
    expect(tables).toContain('health_checks');
    expect(tables).toContain('incidents');
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: All tests pass, including the 3 new table assertions.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts src/lib/types.ts tests/lib/db.test.ts
git commit -m "feat(ops): add endpoints, health_checks, incidents schema and types"
```

---

### Task 2: Endpoint Queries

**Files:**
- Create: `src/lib/queries/endpoint-queries.ts`
- Create: `tests/queries/endpoint-queries.test.ts`

- [ ] **Step 1: Write the test file `tests/queries/endpoint-queries.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initDb } from '@/lib/db';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-endpoints.db');

describe('endpoint queries', () => {
  let db: Database.Database;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    db = initDb(TEST_DB_PATH);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('creates and retrieves an endpoint', async () => {
    const { createEndpoint, getEndpointById } = await import('@/lib/queries/endpoint-queries');
    const id = createEndpoint(db, { name: 'Test App', url: 'http://localhost:3000/health', check_interval_seconds: 60, slow_threshold_ms: 3000, is_active: 1 });
    const ep = getEndpointById(db, id);
    expect(ep).toBeTruthy();
    expect(ep!.name).toBe('Test App');
    expect(ep!.url).toBe('http://localhost:3000/health');
    expect(ep!.check_interval_seconds).toBe(60);
  });

  it('lists all endpoints', async () => {
    const { createEndpoint, listEndpoints } = await import('@/lib/queries/endpoint-queries');
    createEndpoint(db, { name: 'App A', url: 'http://a.com', check_interval_seconds: 300, slow_threshold_ms: 5000, is_active: 1 });
    createEndpoint(db, { name: 'App B', url: 'http://b.com', check_interval_seconds: 300, slow_threshold_ms: 5000, is_active: 1 });
    const all = listEndpoints(db);
    expect(all).toHaveLength(2);
  });

  it('updates an endpoint', async () => {
    const { createEndpoint, updateEndpoint, getEndpointById } = await import('@/lib/queries/endpoint-queries');
    const id = createEndpoint(db, { name: 'Old Name', url: 'http://old.com', check_interval_seconds: 300, slow_threshold_ms: 5000, is_active: 1 });
    updateEndpoint(db, id, { name: 'New Name', url: 'http://new.com', check_interval_seconds: 60, slow_threshold_ms: 2000, is_active: 0 });
    const ep = getEndpointById(db, id);
    expect(ep!.name).toBe('New Name');
    expect(ep!.is_active).toBe(0);
  });

  it('deletes an endpoint', async () => {
    const { createEndpoint, deleteEndpoint, getEndpointById } = await import('@/lib/queries/endpoint-queries');
    const id = createEndpoint(db, { name: 'Doomed', url: 'http://doomed.com', check_interval_seconds: 300, slow_threshold_ms: 5000, is_active: 1 });
    deleteEndpoint(db, id);
    expect(getEndpointById(db, id)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/queries/endpoint-queries.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/lib/queries/endpoint-queries.ts`**

```typescript
import type Database from 'better-sqlite3';
import type { Endpoint } from '@/lib/types';

interface CreateEndpointInput {
  name: string;
  url: string;
  check_interval_seconds: number;
  slow_threshold_ms: number;
  is_active: number;
}

export function createEndpoint(db: Database.Database, input: CreateEndpointInput): number {
  const result = db.prepare(
    `INSERT INTO endpoints (name, url, check_interval_seconds, slow_threshold_ms, is_active) VALUES (?, ?, ?, ?, ?)`
  ).run(input.name, input.url, input.check_interval_seconds, input.slow_threshold_ms, input.is_active);
  return Number(result.lastInsertRowid);
}

export function getEndpointById(db: Database.Database, id: number): Endpoint | undefined {
  return db.prepare('SELECT * FROM endpoints WHERE id = ?').get(id) as Endpoint | undefined;
}

export function listEndpoints(db: Database.Database): Endpoint[] {
  return db.prepare('SELECT * FROM endpoints ORDER BY name ASC').all() as Endpoint[];
}

export function listActiveEndpoints(db: Database.Database): Endpoint[] {
  return db.prepare('SELECT * FROM endpoints WHERE is_active = 1 ORDER BY name ASC').all() as Endpoint[];
}

export function updateEndpoint(db: Database.Database, id: number, input: CreateEndpointInput): void {
  db.prepare(
    `UPDATE endpoints SET name = ?, url = ?, check_interval_seconds = ?, slow_threshold_ms = ?, is_active = ? WHERE id = ?`
  ).run(input.name, input.url, input.check_interval_seconds, input.slow_threshold_ms, input.is_active, id);
}

export function deleteEndpoint(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM endpoints WHERE id = ?').run(id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/queries/endpoint-queries.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/endpoint-queries.ts tests/queries/endpoint-queries.test.ts
git commit -m "feat(ops): add endpoint CRUD queries with tests"
```

---

### Task 3: Health Check Queries

**Files:**
- Create: `src/lib/queries/health-check-queries.ts`
- Create: `tests/queries/health-check-queries.test.ts`

- [ ] **Step 1: Write the test file `tests/queries/health-check-queries.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initDb } from '@/lib/db';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-healthchecks.db');

describe('health check queries', () => {
  let db: Database.Database;
  let endpointId: number;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    db = initDb(TEST_DB_PATH);
    endpointId = Number(db.prepare("INSERT INTO endpoints (name, url) VALUES (?, ?)").run('Test', 'http://test.com').lastInsertRowid);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('records a health check', async () => {
    const { recordHealthCheck, getLastHealthCheck } = await import('@/lib/queries/health-check-queries');
    recordHealthCheck(db, { endpoint_id: endpointId, status_code: 200, response_time_ms: 150, is_healthy: 1 });
    const last = getLastHealthCheck(db, endpointId);
    expect(last).toBeTruthy();
    expect(last!.status_code).toBe(200);
    expect(last!.is_healthy).toBe(1);
  });

  it('gets last N health checks for an endpoint', async () => {
    const { recordHealthCheck, getLastNHealthChecks } = await import('@/lib/queries/health-check-queries');
    recordHealthCheck(db, { endpoint_id: endpointId, status_code: 200, response_time_ms: 100, is_healthy: 1 });
    recordHealthCheck(db, { endpoint_id: endpointId, status_code: 500, response_time_ms: 200, is_healthy: 0 });
    recordHealthCheck(db, { endpoint_id: endpointId, status_code: null, response_time_ms: 10000, is_healthy: 0 });
    const last2 = getLastNHealthChecks(db, endpointId, 2);
    expect(last2).toHaveLength(2);
    expect(last2[0].is_healthy).toBe(0); // newest first
    expect(last2[1].is_healthy).toBe(0);
  });

  it('computes uptime percentage over 30 days', async () => {
    const { recordHealthCheck, getUptimePercent } = await import('@/lib/queries/health-check-queries');
    for (let i = 0; i < 8; i++) recordHealthCheck(db, { endpoint_id: endpointId, status_code: 200, response_time_ms: 100, is_healthy: 1 });
    for (let i = 0; i < 2; i++) recordHealthCheck(db, { endpoint_id: endpointId, status_code: 500, response_time_ms: 100, is_healthy: 0 });
    const uptime = getUptimePercent(db, endpointId);
    expect(uptime).toBeCloseTo(80, 0);
  });

  it('computes average response time over 24 hours', async () => {
    const { recordHealthCheck, getAvgResponseTime24h } = await import('@/lib/queries/health-check-queries');
    recordHealthCheck(db, { endpoint_id: endpointId, status_code: 200, response_time_ms: 100, is_healthy: 1 });
    recordHealthCheck(db, { endpoint_id: endpointId, status_code: 200, response_time_ms: 300, is_healthy: 1 });
    const avg = getAvgResponseTime24h(db, endpointId);
    expect(avg).toBe(200);
  });

  it('gets health checks for last 24 hours for chart', async () => {
    const { recordHealthCheck, getHealthChecks24h } = await import('@/lib/queries/health-check-queries');
    recordHealthCheck(db, { endpoint_id: endpointId, status_code: 200, response_time_ms: 150, is_healthy: 1 });
    const checks = getHealthChecks24h(db, endpointId);
    expect(checks).toHaveLength(1);
    expect(checks[0].response_time_ms).toBe(150);
  });

  it('deletes old health checks', async () => {
    const { recordHealthCheck, deleteOldHealthChecks } = await import('@/lib/queries/health-check-queries');
    // Insert a check with old date manually
    db.prepare("INSERT INTO health_checks (endpoint_id, status_code, response_time_ms, is_healthy, checked_at) VALUES (?, ?, ?, ?, datetime('now', '-31 days'))").run(endpointId, 200, 100, 1);
    recordHealthCheck(db, { endpoint_id: endpointId, status_code: 200, response_time_ms: 100, is_healthy: 1 });
    const deleted = deleteOldHealthChecks(db);
    expect(deleted).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/queries/health-check-queries.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/lib/queries/health-check-queries.ts`**

```typescript
import type Database from 'better-sqlite3';
import type { HealthCheck } from '@/lib/types';

interface RecordHealthCheckInput {
  endpoint_id: number;
  status_code: number | null;
  response_time_ms: number;
  is_healthy: number;
}

export function recordHealthCheck(db: Database.Database, input: RecordHealthCheckInput): number {
  const result = db.prepare(
    `INSERT INTO health_checks (endpoint_id, status_code, response_time_ms, is_healthy) VALUES (?, ?, ?, ?)`
  ).run(input.endpoint_id, input.status_code, input.response_time_ms, input.is_healthy);
  return Number(result.lastInsertRowid);
}

export function getLastHealthCheck(db: Database.Database, endpointId: number): HealthCheck | undefined {
  return db.prepare(
    'SELECT * FROM health_checks WHERE endpoint_id = ? ORDER BY checked_at DESC LIMIT 1'
  ).get(endpointId) as HealthCheck | undefined;
}

export function getLastNHealthChecks(db: Database.Database, endpointId: number, n: number): HealthCheck[] {
  return db.prepare(
    'SELECT * FROM health_checks WHERE endpoint_id = ? ORDER BY checked_at DESC LIMIT ?'
  ).all(endpointId, n) as HealthCheck[];
}

export function getUptimePercent(db: Database.Database, endpointId: number): number {
  const row = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN is_healthy = 1 THEN 1 ELSE 0 END) as healthy
    FROM health_checks
    WHERE endpoint_id = ? AND checked_at >= datetime('now', '-30 days')
  `).get(endpointId) as { total: number; healthy: number };
  if (row.total === 0) return 100;
  return (row.healthy / row.total) * 100;
}

export function getAvgResponseTime24h(db: Database.Database, endpointId: number): number {
  const row = db.prepare(`
    SELECT COALESCE(CAST(AVG(response_time_ms) AS INTEGER), 0) as avg_ms
    FROM health_checks
    WHERE endpoint_id = ? AND checked_at >= datetime('now', '-1 day')
  `).get(endpointId) as { avg_ms: number };
  return row.avg_ms;
}

export function getHealthChecks24h(db: Database.Database, endpointId: number): HealthCheck[] {
  return db.prepare(
    `SELECT * FROM health_checks WHERE endpoint_id = ? AND checked_at >= datetime('now', '-1 day') ORDER BY checked_at ASC`
  ).all(endpointId) as HealthCheck[];
}

export function deleteOldHealthChecks(db: Database.Database): number {
  const result = db.prepare(
    `DELETE FROM health_checks WHERE checked_at < datetime('now', '-30 days')`
  ).run();
  return result.changes;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/queries/health-check-queries.test.ts`
Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/health-check-queries.ts tests/queries/health-check-queries.test.ts
git commit -m "feat(ops): add health check recording and stats queries with tests"
```

---

### Task 4: Incident Queries

**Files:**
- Create: `src/lib/queries/incident-queries.ts`
- Create: `tests/queries/incident-queries.test.ts`

- [ ] **Step 1: Write the test file `tests/queries/incident-queries.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initDb } from '@/lib/db';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-incidents.db');

describe('incident queries', () => {
  let db: Database.Database;
  let endpointId: number;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    db = initDb(TEST_DB_PATH);
    endpointId = Number(db.prepare("INSERT INTO endpoints (name, url) VALUES (?, ?)").run('Test', 'http://test.com').lastInsertRowid);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('creates an incident and finds it as open', async () => {
    const { createIncident, getOpenIncident } = await import('@/lib/queries/incident-queries');
    createIncident(db, endpointId);
    const open = getOpenIncident(db, endpointId);
    expect(open).toBeTruthy();
    expect(open!.endpoint_id).toBe(endpointId);
    expect(open!.resolved_at).toBeNull();
  });

  it('resolves an open incident', async () => {
    const { createIncident, getOpenIncident, resolveIncident, getIncidentById } = await import('@/lib/queries/incident-queries');
    createIncident(db, endpointId);
    const open = getOpenIncident(db, endpointId)!;
    resolveIncident(db, open.id);
    const resolved = getIncidentById(db, open.id);
    expect(resolved!.resolved_at).toBeTruthy();
    expect(resolved!.duration_seconds).toBeGreaterThanOrEqual(0);
  });

  it('lists incidents for an endpoint sorted newest first', async () => {
    const { createIncident, resolveIncident, getOpenIncident, listIncidents } = await import('@/lib/queries/incident-queries');
    createIncident(db, endpointId);
    const first = getOpenIncident(db, endpointId)!;
    resolveIncident(db, first.id);
    createIncident(db, endpointId);
    const all = listIncidents(db, endpointId);
    expect(all).toHaveLength(2);
  });

  it('counts total incidents for an endpoint', async () => {
    const { createIncident, resolveIncident, getOpenIncident, getTotalIncidentCount } = await import('@/lib/queries/incident-queries');
    createIncident(db, endpointId);
    resolveIncident(db, getOpenIncident(db, endpointId)!.id);
    createIncident(db, endpointId);
    expect(getTotalIncidentCount(db, endpointId)).toBe(2);
  });

  it('lists all open incidents across all endpoints', async () => {
    const { createIncident, listOpenIncidents } = await import('@/lib/queries/incident-queries');
    const ep2 = Number(db.prepare("INSERT INTO endpoints (name, url) VALUES (?, ?)").run('Test2', 'http://test2.com').lastInsertRowid);
    createIncident(db, endpointId);
    createIncident(db, ep2);
    const open = listOpenIncidents(db);
    expect(open).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/queries/incident-queries.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/lib/queries/incident-queries.ts`**

```typescript
import type Database from 'better-sqlite3';
import type { Incident } from '@/lib/types';

export function createIncident(db: Database.Database, endpointId: number): number {
  const result = db.prepare(
    `INSERT INTO incidents (endpoint_id) VALUES (?)`
  ).run(endpointId);
  return Number(result.lastInsertRowid);
}

export function getOpenIncident(db: Database.Database, endpointId: number): Incident | undefined {
  return db.prepare(
    'SELECT * FROM incidents WHERE endpoint_id = ? AND resolved_at IS NULL LIMIT 1'
  ).get(endpointId) as Incident | undefined;
}

export function getIncidentById(db: Database.Database, id: number): Incident | undefined {
  return db.prepare('SELECT * FROM incidents WHERE id = ?').get(id) as Incident | undefined;
}

export function resolveIncident(db: Database.Database, id: number): void {
  db.prepare(`
    UPDATE incidents
    SET resolved_at = datetime('now'),
        duration_seconds = CAST((julianday('now') - julianday(started_at)) * 86400 AS INTEGER)
    WHERE id = ?
  `).run(id);
}

export function listIncidents(db: Database.Database, endpointId: number): Incident[] {
  return db.prepare(
    'SELECT * FROM incidents WHERE endpoint_id = ? ORDER BY started_at DESC'
  ).all(endpointId) as Incident[];
}

export function getTotalIncidentCount(db: Database.Database, endpointId: number): number {
  return (db.prepare(
    'SELECT COUNT(*) as count FROM incidents WHERE endpoint_id = ?'
  ).get(endpointId) as { count: number }).count;
}

export interface OpenIncidentWithEndpoint extends Incident {
  endpoint_name: string;
}

export function listOpenIncidents(db: Database.Database): OpenIncidentWithEndpoint[] {
  return db.prepare(`
    SELECT i.*, e.name as endpoint_name
    FROM incidents i JOIN endpoints e ON i.endpoint_id = e.id
    WHERE i.resolved_at IS NULL
    ORDER BY i.started_at ASC
  `).all() as OpenIncidentWithEndpoint[];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/queries/incident-queries.test.ts`
Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/incident-queries.ts tests/queries/incident-queries.test.ts
git commit -m "feat(ops): add incident create/resolve/list queries with tests"
```

---

### Task 5: Endpoint Server Actions

**Files:**
- Create: `src/lib/actions/endpoint-actions.ts`

- [ ] **Step 1: Write `src/lib/actions/endpoint-actions.ts`**

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { createEndpoint, updateEndpoint, deleteEndpoint } from '@/lib/queries/endpoint-queries';

export async function createEndpointAction(formData: FormData) {
  const db = getDb();
  const id = createEndpoint(db, {
    name: formData.get('name') as string,
    url: formData.get('url') as string,
    check_interval_seconds: Number(formData.get('check_interval_seconds')) || 300,
    slow_threshold_ms: Number(formData.get('slow_threshold_ms')) || 5000,
    is_active: formData.has('is_active') ? 1 : 0,
  });
  revalidatePath('/ops');
  redirect(`/ops/${id}`);
}

export async function updateEndpointAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  updateEndpoint(db, id, {
    name: formData.get('name') as string,
    url: formData.get('url') as string,
    check_interval_seconds: Number(formData.get('check_interval_seconds')) || 300,
    slow_threshold_ms: Number(formData.get('slow_threshold_ms')) || 5000,
    is_active: formData.has('is_active') ? 1 : 0,
  });
  revalidatePath('/ops');
  redirect(`/ops/${id}`);
}

export async function deleteEndpointAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  deleteEndpoint(db, id);
  revalidatePath('/ops');
  redirect('/ops');
}
```

- [ ] **Step 2: Verify build**

Run: `npx next build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/endpoint-actions.ts
git commit -m "feat(ops): add endpoint server actions (create, update, delete)"
```

---

### Task 6: UI Components (StatusDot + ResponseTimeChart)

**Files:**
- Create: `src/components/status-dot.tsx`
- Create: `src/components/response-time-chart.tsx`

- [ ] **Step 1: Write `src/components/status-dot.tsx`**

```typescript
export type DotColor = 'green' | 'red' | 'yellow';

export function StatusDot({ color }: { color: DotColor }) {
  const colorClass = color === 'green' ? 'bg-green-500' : color === 'red' ? 'bg-red-500' : 'bg-yellow-500';
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${colorClass}`} />;
}
```

- [ ] **Step 2: Write `src/components/response-time-chart.tsx`**

This follows the same CSS-based approach as `src/components/revenue-chart.tsx`.

```typescript
import type { HealthCheck } from '@/lib/types';

export function ResponseTimeChart({ checks }: { checks: HealthCheck[] }) {
  if (checks.length === 0) {
    return <p className="text-sm text-gray-500">No health checks in the last 24 hours.</p>;
  }

  const maxMs = Math.max(...checks.map(c => c.response_time_ms), 1);

  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold mb-4">Response Time (Last 24 Hours)</h3>
      <div className="flex items-end gap-px h-48">
        {checks.map((check) => {
          const height = (check.response_time_ms / maxMs) * 100;
          const barColor = check.is_healthy ? 'bg-blue-600' : 'bg-red-600';
          const time = new Date(check.checked_at + 'Z');
          const label = time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
          return (
            <div
              key={check.id}
              className="flex-1 flex flex-col items-center justify-end h-full"
            >
              <div
                className={`w-full ${barColor} rounded-t transition-all min-h-[2px]`}
                style={{ height: `${Math.max(height, 1)}%` }}
                title={`${label}: ${check.response_time_ms}ms ${check.is_healthy ? '' : '(unhealthy)'}`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs text-gray-500">
          {checks.length > 0 ? new Date(checks[0].checked_at + 'Z').toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}
        </span>
        <span className="text-xs text-gray-500">
          {checks.length > 0 ? new Date(checks[checks.length - 1].checked_at + 'Z').toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npx next build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/status-dot.tsx src/components/response-time-chart.tsx
git commit -m "feat(ops): add StatusDot and ResponseTimeChart components"
```

---

### Task 7: Ops Status List Page (`/ops`)

**Files:**
- Create: `src/app/(dashboard)/ops/page.tsx`

- [ ] **Step 1: Write `src/app/(dashboard)/ops/page.tsx`**

```typescript
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { listEndpoints } from '@/lib/queries/endpoint-queries';
import { getLastHealthCheck, getUptimePercent } from '@/lib/queries/health-check-queries';
import { getOpenIncident } from '@/lib/queries/incident-queries';
import { StatusDot } from '@/components/status-dot';
import type { DotColor } from '@/components/status-dot';

export const dynamic = 'force-dynamic';

export default function OpsPage() {
  const db = getDb();
  const endpoints = listEndpoints(db);

  const rows = endpoints.map((ep) => {
    const lastCheck = getLastHealthCheck(db, ep.id);
    const openIncident = getOpenIncident(db, ep.id);
    const uptime = getUptimePercent(db, ep.id);

    let color: DotColor = 'green';
    if (openIncident) {
      color = 'red';
    } else if (lastCheck && lastCheck.is_healthy && lastCheck.response_time_ms > ep.slow_threshold_ms) {
      color = 'yellow';
    } else if (lastCheck && !lastCheck.is_healthy) {
      color = 'yellow';
    }

    return { ...ep, lastCheck, openIncident, uptime, color };
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Ops Monitor</h2>
        <Link href="/ops/new" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
          + Add Endpoint
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-500">No endpoints configured. Add one to start monitoring.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-800">
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">URL</th>
                <th className="pb-2 font-medium text-right">Response</th>
                <th className="pb-2 font-medium text-right">Uptime (30d)</th>
                <th className="pb-2 font-medium text-right">Last Check</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-gray-800 hover:bg-gray-900/50">
                  <td className="py-3"><StatusDot color={row.color} /></td>
                  <td className="py-3">
                    <Link href={`/ops/${row.id}`} className="text-white hover:text-blue-400">{row.name}</Link>
                  </td>
                  <td className="py-3 text-gray-400 text-xs font-mono truncate max-w-xs">{row.url}</td>
                  <td className="py-3 text-right text-gray-400">
                    {row.lastCheck ? `${row.lastCheck.response_time_ms}ms` : '—'}
                  </td>
                  <td className="py-3 text-right text-gray-400">{row.uptime.toFixed(1)}%</td>
                  <td className="py-3 text-right text-gray-500 text-xs">
                    {row.lastCheck
                      ? new Date(row.lastCheck.checked_at + 'Z').toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                      : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx next build`
Expected: Build succeeds, `/ops` route registered.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/ops/page.tsx
git commit -m "feat(ops): add ops status list page"
```

---

### Task 8: Endpoint Detail Page (`/ops/[id]`)

**Files:**
- Create: `src/app/(dashboard)/ops/[id]/page.tsx`

- [ ] **Step 1: Write `src/app/(dashboard)/ops/[id]/page.tsx`**

```typescript
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getEndpointById } from '@/lib/queries/endpoint-queries';
import { getLastHealthCheck, getUptimePercent, getAvgResponseTime24h, getHealthChecks24h } from '@/lib/queries/health-check-queries';
import { getOpenIncident, listIncidents, getTotalIncidentCount } from '@/lib/queries/incident-queries';
import { deleteEndpointAction } from '@/lib/actions/endpoint-actions';
import { StatusDot } from '@/components/status-dot';
import { ResponseTimeChart } from '@/components/response-time-chart';
import type { DotColor } from '@/components/status-dot';

export const dynamic = 'force-dynamic';

export default async function EndpointDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const endpoint = getEndpointById(db, Number(id));

  if (!endpoint) notFound();

  const lastCheck = getLastHealthCheck(db, endpoint.id);
  const openIncident = getOpenIncident(db, endpoint.id);
  const uptime = getUptimePercent(db, endpoint.id);
  const avgResponse = getAvgResponseTime24h(db, endpoint.id);
  const totalIncidents = getTotalIncidentCount(db, endpoint.id);
  const checks24h = getHealthChecks24h(db, endpoint.id);
  const incidents = listIncidents(db, endpoint.id);

  let color: DotColor = 'green';
  if (openIncident) {
    color = 'red';
  } else if (lastCheck && lastCheck.is_healthy && lastCheck.response_time_ms > endpoint.slow_threshold_ms) {
    color = 'yellow';
  }

  return (
    <div className="p-6">
      <Link href="/ops" className="text-sm text-gray-400 hover:text-white mb-4 inline-block">
        &larr; Back to Ops
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <StatusDot color={color} />
        <h2 className="text-2xl font-bold">{endpoint.name}</h2>
        <span className="text-sm text-gray-400 font-mono">{endpoint.url}</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-6">
        <Link href={`/ops/${endpoint.id}/edit`} className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white hover:bg-gray-700">
          Edit
        </Link>
        <form action={deleteEndpointAction}>
          <input type="hidden" name="id" value={endpoint.id} />
          <button type="submit" className="px-3 py-1.5 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-400 hover:bg-red-900/50"
            onClick={(e) => { if (!confirm('Delete this endpoint?')) e.preventDefault(); }}>
            Delete
          </button>
        </form>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Uptime (30d)</p>
          <p className="text-2xl font-bold text-white">{uptime.toFixed(1)}%</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Avg Response (24h)</p>
          <p className="text-2xl font-bold text-white">{avgResponse}ms</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Total Incidents</p>
          <p className="text-2xl font-bold text-white">{totalIncidents}</p>
        </div>
      </div>

      {/* Response Time Chart */}
      <ResponseTimeChart checks={checks24h} />

      {/* Incident History */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Incident History</h3>
        {incidents.length === 0 ? (
          <p className="text-sm text-gray-500">No incidents recorded.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-800">
                <th className="pb-2 font-medium">Started</th>
                <th className="pb-2 font-medium">Resolved</th>
                <th className="pb-2 font-medium text-right">Duration</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc) => (
                <tr key={inc.id} className="border-b border-gray-800">
                  <td className="py-2 text-gray-400">
                    {new Date(inc.started_at + 'Z').toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </td>
                  <td className="py-2 text-gray-400">
                    {inc.resolved_at
                      ? new Date(inc.resolved_at + 'Z').toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                      : <span className="text-red-400">Ongoing</span>}
                  </td>
                  <td className="py-2 text-right text-gray-400">
                    {inc.duration_seconds != null ? formatDuration(inc.duration_seconds) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}
```

Note: The `onClick` for the delete button uses `confirm()` — this requires client interaction. Since this is on a `<button>` inside a `<form>`, it works with progressive enhancement. However, `onClick` needs a client component wrapper OR it can be an inline handler that Next.js 16 supports on form buttons. If the build complains, wrap just the delete button in a small client component. But typically this pattern works fine because `onClick` on `<button>` is a native DOM attribute that doesn't need a client component — it's passed through as a string attribute. **If TypeScript complains**, remove the `onClick` prop entirely — the form will still work, just without the confirmation dialog.

- [ ] **Step 2: Verify build**

Run: `npx next build`
Expected: Build succeeds, `/ops/[id]` route registered.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/ops/\[id\]/page.tsx
git commit -m "feat(ops): add endpoint detail page with stats, chart, incidents"
```

---

### Task 9: New & Edit Endpoint Pages

**Files:**
- Create: `src/app/(dashboard)/ops/new/page.tsx`
- Create: `src/app/(dashboard)/ops/[id]/edit/page.tsx`

- [ ] **Step 1: Write `src/app/(dashboard)/ops/new/page.tsx`**

```typescript
import Link from 'next/link';
import { createEndpointAction } from '@/lib/actions/endpoint-actions';

export default function NewEndpointPage() {
  return (
    <div className="p-6">
      <Link href="/ops" className="text-sm text-gray-400 hover:text-white mb-4 inline-block">
        &larr; Back to Ops
      </Link>
      <h2 className="text-2xl font-bold mb-6">Add Endpoint</h2>

      <form action={createEndpointAction} className="space-y-4 max-w-lg">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Name *</label>
          <input type="text" name="name" required
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            placeholder="e.g. Paul Winkler AI" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">URL *</label>
          <input type="url" name="url" required
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            placeholder="https://example.com/health" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Check Interval (seconds)</label>
            <input type="number" name="check_interval_seconds" defaultValue={300}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Slow Threshold (ms)</label>
            <input type="number" name="slow_threshold_ms" defaultValue={5000}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" name="is_active" id="is_active" defaultChecked
            className="rounded bg-gray-800 border-gray-700" />
          <label htmlFor="is_active" className="text-sm text-gray-400">Active</label>
        </div>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Save Endpoint
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Write `src/app/(dashboard)/ops/[id]/edit/page.tsx`**

```typescript
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getEndpointById } from '@/lib/queries/endpoint-queries';
import { updateEndpointAction } from '@/lib/actions/endpoint-actions';

export const dynamic = 'force-dynamic';

export default async function EditEndpointPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const endpoint = getEndpointById(db, Number(id));

  if (!endpoint) notFound();

  return (
    <div className="p-6">
      <Link href={`/ops/${endpoint.id}`} className="text-sm text-gray-400 hover:text-white mb-4 inline-block">
        &larr; Back to {endpoint.name}
      </Link>
      <h2 className="text-2xl font-bold mb-6">Edit Endpoint</h2>

      <form action={updateEndpointAction} className="space-y-4 max-w-lg">
        <input type="hidden" name="id" value={endpoint.id} />
        <div>
          <label className="block text-sm text-gray-400 mb-1">Name *</label>
          <input type="text" name="name" required defaultValue={endpoint.name}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">URL *</label>
          <input type="url" name="url" required defaultValue={endpoint.url}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Check Interval (seconds)</label>
            <input type="number" name="check_interval_seconds" defaultValue={endpoint.check_interval_seconds}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Slow Threshold (ms)</label>
            <input type="number" name="slow_threshold_ms" defaultValue={endpoint.slow_threshold_ms}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" name="is_active" id="is_active" defaultChecked={endpoint.is_active === 1}
            className="rounded bg-gray-800 border-gray-700" />
          <label htmlFor="is_active" className="text-sm text-gray-400">Active</label>
        </div>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Update Endpoint
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npx next build`
Expected: Build succeeds, `/ops/new` and `/ops/[id]/edit` routes registered.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/ops/new/page.tsx src/app/\(dashboard\)/ops/\[id\]/edit/page.tsx
git commit -m "feat(ops): add new and edit endpoint pages"
```

---

### Task 10: Dashboard Integration

**Files:**
- Modify: `src/lib/queries/dashboard-queries.ts`
- Modify: `src/app/(dashboard)/page.tsx`
- Modify: `tests/queries/dashboard-queries.test.ts`

- [ ] **Step 1: Add `server_down` to `ActionItem` type and `serversDown` to `DashboardSummary`**

In `src/lib/queries/dashboard-queries.ts`:

Update the `ActionItem` interface `type` field:
```typescript
  type: 'overdue_deliverable' | 'due_soon_deliverable' | 'missed_follow_up' | 'overdue_invoice' | 'server_down';
```

Add `serversDown` to `DashboardSummary`:
```typescript
export interface DashboardSummary {
  activeClients: number;
  overdueDeliverables: number;
  monthlyRevenue: number;
  pipelineLeads: number;
  pipelineValue: number;
  needsFollowUp: number;
  outstandingInvoices: number;
  overdueInvoiceAmount: number;
  serversDown: number;
}
```

- [ ] **Step 2: Add server queries to `getDashboardSummary` and `getActionItems`**

In `getDashboardSummary`, add after the `overdueInvoiceAmount` line:

```typescript
  const serversDown = (db.prepare("SELECT COUNT(*) as count FROM incidents WHERE resolved_at IS NULL").get() as any).count;
```

And update the return to include `serversDown`.

In `getActionItems`, add after the overdue invoices block:

```typescript
  // Down servers
  const downServers = db.prepare(`
    SELECT i.id as incident_id, i.started_at, e.id as endpoint_id, e.name as endpoint_name
    FROM incidents i JOIN endpoints e ON i.endpoint_id = e.id
    WHERE i.resolved_at IS NULL
    ORDER BY i.started_at ASC
  `).all() as any[];

  for (const srv of downServers) {
    items.push({
      type: 'server_down',
      title: `DOWN: ${srv.endpoint_name} since ${srv.started_at}`,
      link: `/ops/${srv.endpoint_id}`,
      urgency: 'red',
    });
  }
```

- [ ] **Step 3: Add Servers card to dashboard page**

In `src/app/(dashboard)/page.tsx`, change the grid from `grid-cols-2 md:grid-cols-4` to `grid-cols-2 md:grid-cols-5` and add after the Pipeline card:

```typescript
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Servers</p>
          <p className={`text-2xl font-bold ${summary.serversDown > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {summary.serversDown > 0 ? `${summary.serversDown} down` : 'All OK'}
          </p>
        </div>
```

Also update the action items label section to handle `server_down`:

Change the label span logic:
```typescript
                  {item.type === 'overdue_invoice' ? 'OVERDUE' : item.type === 'missed_follow_up' ? 'FOLLOW UP' : item.type === 'server_down' ? 'DOWN' : item.urgency === 'red' ? 'OVERDUE' : 'DUE SOON'}
```

- [ ] **Step 4: Add dashboard test for server_down action items**

In `tests/queries/dashboard-queries.test.ts`, add this test:

```typescript
  it('includes down servers in action items', async () => {
    const { getActionItems, getDashboardSummary } = await import('@/lib/queries/dashboard-queries');
    const epId = Number(db.prepare("INSERT INTO endpoints (name, url) VALUES (?, ?)").run('Test Server', 'http://test.com').lastInsertRowid);
    db.prepare("INSERT INTO incidents (endpoint_id) VALUES (?)").run(epId);

    const items = getActionItems(db);
    const serverItems = items.filter(i => i.type === 'server_down');
    expect(serverItems).toHaveLength(1);
    expect(serverItems[0].title).toContain('Test Server');
    expect(serverItems[0].urgency).toBe('red');

    const summary = getDashboardSummary(db);
    expect(summary.serversDown).toBe(1);
  });
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/queries/dashboard-queries.ts src/app/\(dashboard\)/page.tsx tests/queries/dashboard-queries.test.ts
git commit -m "feat(ops): integrate server status into dashboard summary and action items"
```

---

### Task 11: Health Check Cron Script + Seed Script

**Files:**
- Create: `scripts/health-check.ts`
- Create: `scripts/seed-endpoints.ts`
- Modify: `package.json` (add npm scripts)

- [ ] **Step 1: Write `scripts/seed-endpoints.ts`**

```typescript
import { initDb } from '../src/lib/db';

const db = initDb();

const count = (db.prepare('SELECT COUNT(*) as count FROM endpoints').get() as any).count;

if (count === 0) {
  const insert = db.prepare('INSERT INTO endpoints (name, url) VALUES (?, ?)');
  insert.run('Paul Winkler AI', 'http://165.227.185.182/api/v1/health');
  insert.run('GrantCraft AI', 'https://147.182.217.191');
  insert.run('Zerona Content Engine', 'https://159.89.91.177/health');
  insert.run('CommandPost', 'http://localhost:3004');
  console.log('Seeded 4 endpoints.');
} else {
  console.log(`Endpoints table already has ${count} rows. Skipping seed.`);
}

db.close();
```

- [ ] **Step 2: Write `scripts/health-check.ts`**

```typescript
import { initDb } from '../src/lib/db';
import { listActiveEndpoints } from '../src/lib/queries/endpoint-queries';
import { recordHealthCheck, getLastHealthCheck, getLastNHealthChecks, deleteOldHealthChecks } from '../src/lib/queries/health-check-queries';
import { getOpenIncident, createIncident, resolveIncident } from '../src/lib/queries/incident-queries';

const TIMEOUT_MS = 10_000;

async function checkEndpoint(url: string): Promise<{ statusCode: number | null; responseTimeMs: number; isHealthy: boolean }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const responseTimeMs = Date.now() - start;
    const isHealthy = response.status >= 200 && response.status < 300;
    return { statusCode: response.status, responseTimeMs, isHealthy };
  } catch {
    return { statusCode: null, responseTimeMs: Date.now() - start, isHealthy: false };
  }
}

async function main() {
  const db = initDb();

  const endpoints = listActiveEndpoints(db);
  const now = Date.now();

  for (const ep of endpoints) {
    // Check if enough time has passed since last check
    const last = getLastHealthCheck(db, ep.id);
    if (last) {
      const lastTime = new Date(last.checked_at + 'Z').getTime();
      if (now - lastTime < ep.check_interval_seconds * 1000) {
        continue; // Not time yet
      }
    }

    console.log(`Checking ${ep.name} (${ep.url})...`);
    const result = await checkEndpoint(ep.url);

    recordHealthCheck(db, {
      endpoint_id: ep.id,
      status_code: result.statusCode,
      response_time_ms: result.responseTimeMs,
      is_healthy: result.isHealthy ? 1 : 0,
    });

    console.log(`  ${result.isHealthy ? 'OK' : 'FAIL'} — ${result.statusCode ?? 'timeout'} in ${result.responseTimeMs}ms`);

    // Down detection: last 2 checks both unhealthy
    if (!result.isHealthy) {
      const last2 = getLastNHealthChecks(db, ep.id, 2);
      if (last2.length >= 2 && last2.every(c => c.is_healthy === 0)) {
        const openIncident = getOpenIncident(db, ep.id);
        if (!openIncident) {
          createIncident(db, ep.id);
          console.log(`  INCIDENT CREATED for ${ep.name}`);
        }
      }
    }

    // Recovery: healthy + open incident → resolve
    if (result.isHealthy) {
      const openIncident = getOpenIncident(db, ep.id);
      if (openIncident) {
        resolveIncident(db, openIncident.id);
        console.log(`  INCIDENT RESOLVED for ${ep.name}`);
      }
    }
  }

  // Data retention
  const deleted = deleteOldHealthChecks(db);
  if (deleted > 0) {
    console.log(`Cleaned up ${deleted} old health checks.`);
  }

  db.close();
}

main().catch((err) => {
  console.error('Health check script failed:', err);
  process.exit(1);
});
```

- [ ] **Step 3: Add npm scripts to `package.json`**

Add to the `"scripts"` section:

```json
"cron:health": "npx tsx scripts/health-check.ts",
"seed:endpoints": "npx tsx scripts/seed-endpoints.ts"
```

- [ ] **Step 4: Test the seed script**

Run: `npx tsx scripts/seed-endpoints.ts`
Expected: Outputs "Seeded 4 endpoints." (or skip message if already seeded).

- [ ] **Step 5: Test the health check script**

Run: `npx tsx scripts/health-check.ts`
Expected: Outputs check results for each endpoint. Some may fail (expected for remote servers), but the script should complete without crashing.

- [ ] **Step 6: Commit**

```bash
git add scripts/health-check.ts scripts/seed-endpoints.ts package.json
git commit -m "feat(ops): add health check cron script and endpoint seed script"
```

---

### Task 12: Final Verification

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass (should be ~50+ tests across all files).

- [ ] **Step 2: Run production build**

Run: `npx next build`
Expected: Clean build with all routes registered including `/ops`, `/ops/[id]`, `/ops/new`, `/ops/[id]/edit`.

- [ ] **Step 3: Seed and run health check**

Run: `npx tsx scripts/seed-endpoints.ts && npx tsx scripts/health-check.ts`
Expected: Endpoints seeded (or already exist), health checks run successfully.

- [ ] **Step 4: Verify dev server**

Run: `npm run dev` and visit `http://localhost:3004/ops`
Expected: Ops page loads showing endpoints with status dots. Dashboard at `/` shows Servers card.

- [ ] **Step 5: Commit any fixes**

If any fixes were needed during verification, commit them.

```bash
git add -A
git commit -m "fix(ops): final verification fixes for Phase 4"
```
