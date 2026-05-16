# Phase 11: Time Tracking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add time tracking per deliverable with per-project hourly rates, manual entry, and auto-generate invoices from uninvoiced time entries.

**Architecture:** New `time_entries` table, new `hourly_rate` column on `projects`. Time is logged from the project detail page, viewable on a new Finances "Time" tab, and uninvoiced entries can generate invoices. Server actions handle mutations, queries handle reads.

**Tech Stack:** Next.js 16 (App Router, async params), better-sqlite3 (WAL mode), Tailwind CSS v4 dark theme, Vitest for testing.

---

## File Structure

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `src/lib/db.ts` | Add `time_entries` table + `hourly_rate` column to projects |
| Modify | `src/lib/types.ts` | Add `TimeEntry` interface, update `Project` interface |
| Create | `src/lib/queries/time-queries.ts` | All time entry query functions |
| Create | `src/lib/actions/time-actions.ts` | Server actions for time entries + invoice generation |
| Modify | `src/lib/queries/project-queries.ts` | Add `hourly_rate` to create/update inputs |
| Modify | `src/lib/actions/project-actions.ts` | Handle `hourly_rate` in form data |
| Modify | `src/components/project-form.tsx` | Add hourly rate field |
| Create | `src/components/time-entry-form.tsx` | Client component for logging time |
| Create | `src/components/time-entries-table.tsx` | Reusable table for displaying time entries |
| Create | `src/components/time-summary-card.tsx` | Summary card (hours, cost, uninvoiced) |
| Modify | `src/components/deliverable-list.tsx` | Show hours per deliverable |
| Modify | `src/app/(dashboard)/clients/[id]/projects/[projectId]/page.tsx` | Add time form + summary + entries |
| Modify | `src/components/finance-tabs.tsx` | Add "Time" tab |
| Create | `src/app/(dashboard)/finances/time/page.tsx` | Finances Time tab page |
| Modify | `src/app/(dashboard)/page.tsx` | Add "Uninvoiced Time" stat card |
| Modify | `src/lib/queries/dashboard-queries.ts` | Add uninvoiced time to dashboard summary |
| Create | `tests/queries/time-queries.test.ts` | Tests for time query functions |
| Create | `tests/actions/time-actions.test.ts` | Tests for time server actions |

---

### Task 1: Database Schema — Add time_entries table and hourly_rate column

**Files:**
- Modify: `src/lib/db.ts:17-177` (add table in `initDb`)
- Modify: `src/lib/types.ts` (add TimeEntry interface, update Project)

- [ ] **Step 1: Add time_entries table to db.ts**

In `src/lib/db.ts`, add the following table creation after the `disk_reports` table (before the closing backtick of `db.exec`):

```typescript
    CREATE TABLE IF NOT EXISTS time_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      deliverable_id INTEGER REFERENCES deliverables(id) ON DELETE SET NULL,
      description TEXT,
      duration_minutes INTEGER NOT NULL,
      entry_date TEXT NOT NULL,
      hourly_rate REAL NOT NULL,
      is_invoiced INTEGER NOT NULL DEFAULT 0,
      invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
```

- [ ] **Step 2: Add hourly_rate column migration to projects table**

Add after the `time_entries` CREATE TABLE in `db.ts`:

```typescript
    -- Add hourly_rate to projects if not exists
    CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY);
    INSERT OR IGNORE INTO _migrations (name) VALUES ('add_hourly_rate_to_projects');
```

And add this after the `db.exec(...)` call but before `return db;`:

```typescript
  // Migration: add hourly_rate to projects
  const hasHourlyRate = db.prepare("SELECT COUNT(*) as count FROM pragma_table_info('projects') WHERE name = 'hourly_rate'").get() as any;
  if (hasHourlyRate.count === 0) {
    db.exec("ALTER TABLE projects ADD COLUMN hourly_rate REAL");
  }
```

- [ ] **Step 3: Update types.ts**

Add to the `Project` interface after `stack_notes`:

```typescript
  hourly_rate: number | null;
```

Add at the end of `src/lib/types.ts`:

```typescript
export interface TimeEntry {
  id: number;
  project_id: number;
  deliverable_id: number | null;
  description: string | null;
  duration_minutes: number;
  entry_date: string;
  hourly_rate: number;
  is_invoiced: number;
  invoice_id: number | null;
  created_at: string;
}
```

- [ ] **Step 4: Verify the app still builds**

Run: `cd /Users/philipsmith/commandpost && npm run build 2>&1 | tail -20`
Expected: Build succeeds (may have warnings about unused TimeEntry type, that's fine)

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts src/lib/types.ts
git commit -m "feat(time): add time_entries table and hourly_rate column to projects"
```

---

### Task 2: Project hourly_rate support in queries and actions

**Files:**
- Modify: `src/lib/queries/project-queries.ts:4-23,31-75`
- Modify: `src/lib/actions/project-actions.ts:13-49`
- Modify: `src/components/project-form.tsx:60-120`

- [ ] **Step 1: Update CreateProjectInput and UpdateProjectInput**

In `src/lib/queries/project-queries.ts`, add `hourly_rate?: number | null;` to both `CreateProjectInput` (after `stack_notes`) and `UpdateProjectInput` (after `stack_notes`).

- [ ] **Step 2: Update createProject function**

Change the SQL in `createProject` to include `hourly_rate`:

```typescript
export function createProject(db: Database.Database, input: CreateProjectInput): number {
  const stmt = db.prepare(`
    INSERT INTO projects (client_id, name, status, start_date, server_ip, repo_url, deploy_command, stack_notes, hourly_rate)
    VALUES (@client_id, @name, @status, @start_date, @server_ip, @repo_url, @deploy_command, @stack_notes, @hourly_rate)
  `);

  const result = stmt.run({
    client_id: input.client_id,
    name: input.name,
    status: input.status ?? 'active',
    start_date: input.start_date ?? null,
    server_ip: input.server_ip ?? null,
    repo_url: input.repo_url ?? null,
    deploy_command: input.deploy_command ?? null,
    stack_notes: input.stack_notes ?? null,
    hourly_rate: input.hourly_rate ?? null,
  });

  return Number(result.lastInsertRowid);
}
```

- [ ] **Step 3: Update project actions to handle hourly_rate**

In `src/lib/actions/project-actions.ts`, add to both `createProjectAction` and `updateProjectAction`:

```typescript
const hourlyRateStr = formData.get('hourly_rate') as string;
const hourly_rate = hourlyRateStr ? Number(hourlyRateStr) : null;
```

Pass `hourly_rate` in the object passed to `createProject` / `updateProject`.

- [ ] **Step 4: Add hourly rate field to ProjectForm**

In `src/components/project-form.tsx`, add after the Status/Start Date grid (after line 58):

```tsx
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">
          Hourly Rate ($)
        </label>
        <input
          type="number"
          name="hourly_rate"
          step="0.01"
          min="0"
          defaultValue={project?.hourly_rate ?? ''}
          placeholder="e.g. 150.00"
          className={inputClass}
        />
      </div>
```

- [ ] **Step 5: Build and verify**

Run: `cd /Users/philipsmith/commandpost && npm run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/lib/queries/project-queries.ts src/lib/actions/project-actions.ts src/components/project-form.tsx
git commit -m "feat(time): add hourly_rate to project create/edit flow"
```

---

### Task 3: Time entry queries

**Files:**
- Create: `src/lib/queries/time-queries.ts`
- Create: `tests/queries/time-queries.test.ts`

- [ ] **Step 1: Write tests for time queries**

Create `tests/queries/time-queries.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { initDb } from '@/lib/db';
import { createProject } from '@/lib/queries/project-queries';
import {
  createTimeEntry,
  getTimeEntriesByProject,
  getUninvoicedByProject,
  getUninvoicedByClient,
  getProjectTimeSummary,
  getDeliverableHours,
  getTimeStats,
} from '@/lib/queries/time-queries';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeEach(() => {
  db = initDb(':memory:');
  db.exec("INSERT INTO clients (name) VALUES ('Test Client')");
  db.exec("INSERT INTO projects (client_id, name, hourly_rate) VALUES (1, 'Test Project', 150)");
  db.exec("INSERT INTO deliverables (project_id, title) VALUES (1, 'Design Homepage')");
});

describe('createTimeEntry', () => {
  it('creates and returns an entry id', () => {
    const id = createTimeEntry(db, {
      project_id: 1,
      deliverable_id: 1,
      duration_minutes: 90,
      entry_date: '2026-05-15',
      hourly_rate: 150,
      description: 'Mockups',
    });
    expect(id).toBe(1);
  });
});

describe('getTimeEntriesByProject', () => {
  it('returns entries sorted by date desc', () => {
    createTimeEntry(db, { project_id: 1, duration_minutes: 60, entry_date: '2026-05-14', hourly_rate: 150 });
    createTimeEntry(db, { project_id: 1, duration_minutes: 30, entry_date: '2026-05-15', hourly_rate: 150 });
    const entries = getTimeEntriesByProject(db, 1);
    expect(entries).toHaveLength(2);
    expect(entries[0].entry_date).toBe('2026-05-15');
  });
});

describe('getUninvoicedByProject', () => {
  it('returns only uninvoiced entries', () => {
    createTimeEntry(db, { project_id: 1, duration_minutes: 60, entry_date: '2026-05-14', hourly_rate: 150 });
    createTimeEntry(db, { project_id: 1, duration_minutes: 30, entry_date: '2026-05-15', hourly_rate: 150 });
    db.exec("UPDATE time_entries SET is_invoiced = 1 WHERE id = 1");
    const entries = getUninvoicedByProject(db, 1);
    expect(entries).toHaveLength(1);
    expect(entries[0].duration_minutes).toBe(30);
  });
});

describe('getUninvoicedByClient', () => {
  it('returns uninvoiced entries across all client projects', () => {
    createTimeEntry(db, { project_id: 1, duration_minutes: 60, entry_date: '2026-05-14', hourly_rate: 150 });
    const entries = getUninvoicedByClient(db, 1);
    expect(entries).toHaveLength(1);
  });
});

describe('getProjectTimeSummary', () => {
  it('computes total hours and uninvoiced amounts', () => {
    createTimeEntry(db, { project_id: 1, duration_minutes: 90, entry_date: '2026-05-14', hourly_rate: 100 });
    createTimeEntry(db, { project_id: 1, duration_minutes: 60, entry_date: '2026-05-15', hourly_rate: 150 });
    db.exec("UPDATE time_entries SET is_invoiced = 1 WHERE id = 1");
    const summary = getProjectTimeSummary(db, 1);
    expect(summary.totalHours).toBeCloseTo(2.5);
    expect(summary.totalCost).toBeCloseTo(150 + 150); // (90/60*100) + (60/60*150)
    expect(summary.uninvoicedHours).toBeCloseTo(1);
    expect(summary.uninvoicedCost).toBeCloseTo(150);
  });
});

describe('getDeliverableHours', () => {
  it('returns hours per deliverable', () => {
    createTimeEntry(db, { project_id: 1, deliverable_id: 1, duration_minutes: 90, entry_date: '2026-05-14', hourly_rate: 150 });
    createTimeEntry(db, { project_id: 1, deliverable_id: 1, duration_minutes: 30, entry_date: '2026-05-15', hourly_rate: 150 });
    const hours = getDeliverableHours(db, 1);
    expect(hours[1]).toBeCloseTo(2);
  });
});

describe('getTimeStats', () => {
  it('returns monthly and uninvoiced stats', () => {
    const today = new Date().toISOString().slice(0, 10);
    createTimeEntry(db, { project_id: 1, duration_minutes: 120, entry_date: today, hourly_rate: 100 });
    const stats = getTimeStats(db);
    expect(stats.hoursThisMonth).toBeCloseTo(2);
    expect(stats.uninvoicedTotal).toBeCloseTo(200);
    expect(stats.uninvoicedHours).toBeCloseTo(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/philipsmith/commandpost && npx vitest run tests/queries/time-queries.test.ts 2>&1 | tail -20`
Expected: FAIL — module not found

- [ ] **Step 3: Implement time-queries.ts**

Create `src/lib/queries/time-queries.ts`:

```typescript
import type Database from 'better-sqlite3';
import type { TimeEntry } from '@/lib/types';

interface CreateTimeEntryInput {
  project_id: number;
  deliverable_id?: number | null;
  description?: string | null;
  duration_minutes: number;
  entry_date: string;
  hourly_rate: number;
}

export function createTimeEntry(db: Database.Database, input: CreateTimeEntryInput): number {
  const stmt = db.prepare(`
    INSERT INTO time_entries (project_id, deliverable_id, description, duration_minutes, entry_date, hourly_rate)
    VALUES (@project_id, @deliverable_id, @description, @duration_minutes, @entry_date, @hourly_rate)
  `);
  const result = stmt.run({
    project_id: input.project_id,
    deliverable_id: input.deliverable_id ?? null,
    description: input.description ?? null,
    duration_minutes: input.duration_minutes,
    entry_date: input.entry_date,
    hourly_rate: input.hourly_rate,
  });
  return Number(result.lastInsertRowid);
}

export function deleteTimeEntry(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM time_entries WHERE id = ? AND is_invoiced = 0').run(id);
}

export function getTimeEntriesByProject(db: Database.Database, projectId: number): TimeEntry[] {
  return db.prepare('SELECT * FROM time_entries WHERE project_id = ? ORDER BY entry_date DESC').all(projectId) as TimeEntry[];
}

export function getUninvoicedByProject(db: Database.Database, projectId: number): TimeEntry[] {
  return db.prepare('SELECT * FROM time_entries WHERE project_id = ? AND is_invoiced = 0 ORDER BY entry_date DESC').all(projectId) as TimeEntry[];
}

export function getUninvoicedByClient(db: Database.Database, clientId: number): TimeEntry[] {
  return db.prepare(`
    SELECT te.* FROM time_entries te
    JOIN projects p ON te.project_id = p.id
    WHERE p.client_id = ? AND te.is_invoiced = 0
    ORDER BY te.entry_date DESC
  `).all(clientId) as TimeEntry[];
}

export interface ProjectTimeSummary {
  totalHours: number;
  totalCost: number;
  uninvoicedHours: number;
  uninvoicedCost: number;
}

export function getProjectTimeSummary(db: Database.Database, projectId: number): ProjectTimeSummary {
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(duration_minutes), 0) as total_minutes,
      COALESCE(SUM(duration_minutes * hourly_rate / 60.0), 0) as total_cost,
      COALESCE(SUM(CASE WHEN is_invoiced = 0 THEN duration_minutes ELSE 0 END), 0) as uninvoiced_minutes,
      COALESCE(SUM(CASE WHEN is_invoiced = 0 THEN duration_minutes * hourly_rate / 60.0 ELSE 0 END), 0) as uninvoiced_cost
    FROM time_entries WHERE project_id = ?
  `).get(projectId) as any;

  return {
    totalHours: row.total_minutes / 60,
    totalCost: row.total_cost,
    uninvoicedHours: row.uninvoiced_minutes / 60,
    uninvoicedCost: row.uninvoiced_cost,
  };
}

export function getDeliverableHours(db: Database.Database, projectId: number): Record<number, number> {
  const rows = db.prepare(`
    SELECT deliverable_id, SUM(duration_minutes) as total_minutes
    FROM time_entries
    WHERE project_id = ? AND deliverable_id IS NOT NULL
    GROUP BY deliverable_id
  `).all(projectId) as any[];

  const result: Record<number, number> = {};
  for (const row of rows) {
    result[row.deliverable_id] = row.total_minutes / 60;
  }
  return result;
}

export interface TimeStats {
  hoursThisMonth: number;
  uninvoicedTotal: number;
  uninvoicedHours: number;
}

export function getTimeStats(db: Database.Database): TimeStats {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const row = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN entry_date >= ? THEN duration_minutes ELSE 0 END), 0) as month_minutes,
      COALESCE(SUM(CASE WHEN is_invoiced = 0 THEN duration_minutes * hourly_rate / 60.0 ELSE 0 END), 0) as uninvoiced_total,
      COALESCE(SUM(CASE WHEN is_invoiced = 0 THEN duration_minutes ELSE 0 END), 0) as uninvoiced_minutes
    FROM time_entries
  `).get(monthStart) as any;

  return {
    hoursThisMonth: row.month_minutes / 60,
    uninvoicedTotal: row.uninvoiced_total,
    uninvoicedHours: row.uninvoiced_minutes / 60,
  };
}

export interface TimeEntryWithDetails extends TimeEntry {
  client_name: string;
  project_name: string;
  deliverable_title: string | null;
}

export function getTimeEntriesFiltered(
  db: Database.Database,
  filters: { clientId?: number; projectId?: number; startDate?: string; endDate?: string; invoiced?: boolean }
): TimeEntryWithDetails[] {
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters.clientId) {
    conditions.push('p.client_id = ?');
    params.push(filters.clientId);
  }
  if (filters.projectId) {
    conditions.push('te.project_id = ?');
    params.push(filters.projectId);
  }
  if (filters.startDate) {
    conditions.push('te.entry_date >= ?');
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    conditions.push('te.entry_date <= ?');
    params.push(filters.endDate);
  }
  if (filters.invoiced !== undefined) {
    conditions.push('te.is_invoiced = ?');
    params.push(filters.invoiced ? 1 : 0);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return db.prepare(`
    SELECT te.*, c.name as client_name, p.name as project_name, d.title as deliverable_title
    FROM time_entries te
    JOIN projects p ON te.project_id = p.id
    JOIN clients c ON p.client_id = c.id
    LEFT JOIN deliverables d ON te.deliverable_id = d.id
    ${where}
    ORDER BY te.entry_date DESC
  `).all(...params) as TimeEntryWithDetails[];
}

export function markEntriesInvoiced(db: Database.Database, entryIds: number[], invoiceId: number): void {
  const placeholders = entryIds.map(() => '?').join(',');
  db.prepare(`UPDATE time_entries SET is_invoiced = 1, invoice_id = ? WHERE id IN (${placeholders})`).run(invoiceId, ...entryIds);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/philipsmith/commandpost && npx vitest run tests/queries/time-queries.test.ts 2>&1 | tail -30`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/time-queries.ts tests/queries/time-queries.test.ts
git commit -m "feat(time): add time entry query functions with tests"
```

---

### Task 4: Time entry server actions

**Files:**
- Create: `src/lib/actions/time-actions.ts`

- [ ] **Step 1: Create time-actions.ts**

Create `src/lib/actions/time-actions.ts`:

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { createTimeEntry, deleteTimeEntry, getUninvoicedByClient, markEntriesInvoiced } from '@/lib/queries/time-queries';
import { getProjectById } from '@/lib/queries/project-queries';

export async function logTimeAction(formData: FormData) {
  const db = getDb();
  const projectId = Number(formData.get('project_id'));
  const clientId = Number(formData.get('client_id'));
  const deliverableIdStr = formData.get('deliverable_id') as string;
  const deliverableId = deliverableIdStr ? Number(deliverableIdStr) : null;
  const hours = Number(formData.get('hours') || 0);
  const minutes = Number(formData.get('minutes') || 0);
  const durationMinutes = hours * 60 + minutes;
  const entryDate = formData.get('entry_date') as string;
  const description = (formData.get('description') as string) || null;
  const hourlyRate = Number(formData.get('hourly_rate'));

  if (durationMinutes <= 0) return;

  createTimeEntry(db, {
    project_id: projectId,
    deliverable_id: deliverableId,
    duration_minutes: durationMinutes,
    entry_date: entryDate,
    hourly_rate: hourlyRate,
    description,
  });

  revalidatePath(`/clients/${clientId}/projects/${projectId}`);
  revalidatePath('/finances');
}

export async function deleteTimeEntryAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  const clientId = Number(formData.get('client_id'));
  const projectId = Number(formData.get('project_id'));

  deleteTimeEntry(db, id);

  revalidatePath(`/clients/${clientId}/projects/${projectId}`);
  revalidatePath('/finances');
}

export async function generateInvoiceFromTimeAction(formData: FormData) {
  const db = getDb();
  const clientId = Number(formData.get('client_id'));

  const entries = getUninvoicedByClient(db, clientId);
  if (entries.length === 0) return;

  // Generate invoice number
  const lastInvoice = db.prepare("SELECT invoice_number FROM invoices ORDER BY id DESC LIMIT 1").get() as any;
  let nextNum = 1001;
  if (lastInvoice) {
    const match = lastInvoice.invoice_number.match(/(\d+)/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }
  const invoiceNumber = `INV-${nextNum}`;

  // Build line items
  const lineItems: { description: string; quantity: number; unit_price: number; amount: number }[] = [];
  for (const entry of entries) {
    const deliverableTitle = entry.deliverable_id
      ? (db.prepare('SELECT title FROM deliverables WHERE id = ?').get(entry.deliverable_id) as any)?.title
      : null;
    const desc = deliverableTitle
      ? entry.description ? `${deliverableTitle} — ${entry.description}` : deliverableTitle
      : entry.description || 'Time entry';
    const quantity = Math.round((entry.duration_minutes / 60) * 100) / 100;
    const amount = Math.round(quantity * entry.hourly_rate * 100) / 100;
    lineItems.push({ description: desc, quantity, unit_price: entry.hourly_rate, amount });
  }

  const totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Create invoice
  const invoiceResult = db.prepare(`
    INSERT INTO invoices (client_id, invoice_number, status, due_date, total_amount)
    VALUES (?, ?, 'draft', ?, ?)
  `).run(clientId, invoiceNumber, dueDate, totalAmount);
  const invoiceId = Number(invoiceResult.lastInsertRowid);

  // Create line items
  const insertItem = db.prepare(`
    INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const item of lineItems) {
    insertItem.run(invoiceId, item.description, item.quantity, item.unit_price, item.amount);
  }

  // Mark entries as invoiced
  markEntriesInvoiced(db, entries.map(e => e.id), invoiceId);

  revalidatePath('/finances');
  redirect(`/finances/invoices/${invoiceId}`);
}

export async function updateProjectRateAction(formData: FormData) {
  const db = getDb();
  const projectId = Number(formData.get('project_id'));
  const clientId = Number(formData.get('client_id'));
  const hourlyRate = Number(formData.get('hourly_rate'));

  db.prepare("UPDATE projects SET hourly_rate = ?, updated_at = datetime('now') WHERE id = ?").run(hourlyRate, projectId);

  revalidatePath(`/clients/${clientId}/projects/${projectId}`);
}
```

- [ ] **Step 2: Build to verify no syntax errors**

Run: `cd /Users/philipsmith/commandpost && npm run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/time-actions.ts
git commit -m "feat(time): add server actions for time logging and invoice generation"
```

---

### Task 5: Time Entry Form component

**Files:**
- Create: `src/components/time-entry-form.tsx`

- [ ] **Step 1: Create time-entry-form.tsx**

Create `src/components/time-entry-form.tsx`:

```tsx
'use client';

import { useRef } from 'react';
import type { Deliverable } from '@/lib/types';
import { logTimeAction } from '@/lib/actions/time-actions';

interface TimeEntryFormProps {
  clientId: number;
  projectId: number;
  deliverables: Deliverable[];
  defaultRate: number | null;
}

export function TimeEntryForm({ clientId, projectId, deliverables, defaultRate }: TimeEntryFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const today = new Date().toISOString().slice(0, 10);

  const inputClass =
    'w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm';

  async function handleSubmit(formData: FormData) {
    await logTimeAction(formData);
    formRef.current?.reset();
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-white mb-4">Log Time</h3>
      <form ref={formRef} action={handleSubmit} className="space-y-4">
        <input type="hidden" name="project_id" value={projectId} />
        <input type="hidden" name="client_id" value={clientId} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Deliverable</label>
            <select name="deliverable_id" className={inputClass}>
              <option value="">Project-level (no deliverable)</option>
              {deliverables.map((d) => (
                <option key={d.id} value={d.id}>{d.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Date</label>
            <input type="date" name="entry_date" defaultValue={today} required className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Hours</label>
            <input type="number" name="hours" min="0" defaultValue="0" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Minutes</label>
            <input type="number" name="minutes" min="0" max="59" defaultValue="0" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Rate ($/hr)</label>
            <input type="number" name="hourly_rate" step="0.01" min="0" defaultValue={defaultRate ?? ''} required className={inputClass} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Description (optional)</label>
          <input type="text" name="description" placeholder="What did you work on?" className={inputClass} />
        </div>

        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm"
        >
          Log Time
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Build to verify**

Run: `cd /Users/philipsmith/commandpost && npm run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/time-entry-form.tsx
git commit -m "feat(time): add TimeEntryForm component"
```

---

### Task 6: Time Summary Card and Time Entries Table components

**Files:**
- Create: `src/components/time-summary-card.tsx`
- Create: `src/components/time-entries-table.tsx`

- [ ] **Step 1: Create time-summary-card.tsx**

Create `src/components/time-summary-card.tsx`:

```tsx
import type { ProjectTimeSummary } from '@/lib/queries/time-queries';

interface TimeSummaryCardProps {
  summary: ProjectTimeSummary;
}

export function TimeSummaryCard({ summary }: TimeSummaryCardProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
        <p className="text-xs text-gray-500 uppercase mb-1">Total Hours</p>
        <p className="text-xl font-bold text-white">{summary.totalHours.toFixed(1)}h</p>
      </div>
      <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
        <p className="text-xs text-gray-500 uppercase mb-1">Total Cost</p>
        <p className="text-xl font-bold text-white">${summary.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
      </div>
      <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
        <p className="text-xs text-gray-500 uppercase mb-1">Uninvoiced Hours</p>
        <p className="text-xl font-bold text-yellow-400">{summary.uninvoicedHours.toFixed(1)}h</p>
      </div>
      <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
        <p className="text-xs text-gray-500 uppercase mb-1">Uninvoiced Amount</p>
        <p className="text-xl font-bold text-yellow-400">${summary.uninvoicedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create time-entries-table.tsx**

Create `src/components/time-entries-table.tsx`:

```tsx
import type { TimeEntry } from '@/lib/types';
import type { Deliverable } from '@/lib/types';
import { deleteTimeEntryAction } from '@/lib/actions/time-actions';

interface TimeEntriesTableProps {
  entries: TimeEntry[];
  deliverables: Deliverable[];
  clientId: number;
  projectId: number;
}

export function TimeEntriesTable({ entries, deliverables, clientId, projectId }: TimeEntriesTableProps) {
  const deliverableMap = Object.fromEntries(deliverables.map(d => [d.id, d.title]));

  if (entries.length === 0) {
    return <p className="text-gray-500 text-sm">No time entries yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-gray-400 text-left">
            <th className="pb-2 pr-4">Date</th>
            <th className="pb-2 pr-4">Deliverable</th>
            <th className="pb-2 pr-4">Description</th>
            <th className="pb-2 pr-4 text-right">Duration</th>
            <th className="pb-2 pr-4 text-right">Rate</th>
            <th className="pb-2 pr-4 text-right">Amount</th>
            <th className="pb-2 pr-4">Status</th>
            <th className="pb-2"></th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const hours = entry.duration_minutes / 60;
            const amount = hours * entry.hourly_rate;
            return (
              <tr key={entry.id} className="border-b border-gray-800/50">
                <td className="py-2 pr-4 text-white">{entry.entry_date}</td>
                <td className="py-2 pr-4 text-gray-300">
                  {entry.deliverable_id ? deliverableMap[entry.deliverable_id] || '—' : '—'}
                </td>
                <td className="py-2 pr-4 text-gray-300">{entry.description || '—'}</td>
                <td className="py-2 pr-4 text-right text-white">{hours.toFixed(2)}h</td>
                <td className="py-2 pr-4 text-right text-gray-300">${entry.hourly_rate}</td>
                <td className="py-2 pr-4 text-right text-white">${amount.toFixed(2)}</td>
                <td className="py-2 pr-4">
                  <span className={`text-xs px-2 py-0.5 rounded ${entry.is_invoiced ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'}`}>
                    {entry.is_invoiced ? 'Invoiced' : 'Uninvoiced'}
                  </span>
                </td>
                <td className="py-2">
                  {!entry.is_invoiced && (
                    <form action={deleteTimeEntryAction} className="inline">
                      <input type="hidden" name="id" value={entry.id} />
                      <input type="hidden" name="client_id" value={clientId} />
                      <input type="hidden" name="project_id" value={projectId} />
                      <button type="submit" className="text-gray-600 hover:text-red-400 transition-colors" title="Delete">
                        x
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Build to verify**

Run: `cd /Users/philipsmith/commandpost && npm run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/components/time-summary-card.tsx src/components/time-entries-table.tsx
git commit -m "feat(time): add TimeSummaryCard and TimeEntriesTable components"
```

---

### Task 7: Project detail page — integrate time tracking UI

**Files:**
- Modify: `src/app/(dashboard)/clients/[id]/projects/[projectId]/page.tsx`
- Modify: `src/components/deliverable-list.tsx`

- [ ] **Step 1: Update project detail page**

Replace the full content of `src/app/(dashboard)/clients/[id]/projects/[projectId]/page.tsx`:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getClientById } from '@/lib/queries/client-queries';
import { getProjectById, listDeliverables } from '@/lib/queries/project-queries';
import { getTimeEntriesByProject, getProjectTimeSummary, getDeliverableHours } from '@/lib/queries/time-queries';
import { StatusBadge } from '@/components/status-badge';
import { DeliverableList } from '@/components/deliverable-list';
import { ActivityLog } from '@/components/activity-log';
import { DeleteProjectButton } from '@/components/delete-project-button';
import { TimeEntryForm } from '@/components/time-entry-form';
import { TimeSummaryCard } from '@/components/time-summary-card';
import { TimeEntriesTable } from '@/components/time-entries-table';
import { generateInvoiceFromTimeAction } from '@/lib/actions/time-actions';
import type { ActivityLog as ActivityLogType } from '@/lib/types';

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string; projectId: string }>;
}) {
  const { id, projectId } = await params;
  const db = getDb();
  const client = getClientById(db, Number(id));
  const project = getProjectById(db, Number(projectId));

  if (!client || !project) {
    notFound();
  }

  const deliverables = listDeliverables(db, project.id);
  const timeEntries = getTimeEntriesByProject(db, project.id);
  const timeSummary = getProjectTimeSummary(db, project.id);
  const deliverableHours = getDeliverableHours(db, project.id);

  const activities = db
    .prepare('SELECT * FROM activity_logs WHERE project_id = ? ORDER BY created_at DESC LIMIT 50')
    .all(project.id) as ActivityLogType[];

  const techDetails = [
    { label: 'Server IP', value: project.server_ip, mono: true },
    { label: 'Repo URL', value: project.repo_url, mono: true },
    { label: 'Deploy Command', value: project.deploy_command, mono: true },
    { label: 'Stack Notes', value: project.stack_notes, mono: false },
  ].filter((d) => d.value);

  return (
    <div className="p-4 sm:p-6 bg-gray-950 min-h-screen">
      <Link
        href={`/clients/${client.id}`}
        className="text-gray-400 hover:text-white text-sm transition-colors"
      >
        &larr; Back to {client.name}
      </Link>

      <div className="flex items-center gap-4 mt-4 mb-2">
        <h1 className="text-2xl font-bold text-white">{project.name}</h1>
        <StatusBadge status={project.status} />
        <Link
          href={`/clients/${client.id}/projects/${project.id}/edit`}
          className="ml-auto px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
        >
          Edit
        </Link>
      </div>
      <p className="text-gray-500 text-sm mb-6">
        {client.name}
        {project.hourly_rate && <span className="ml-2">&middot; ${project.hourly_rate}/hr</span>}
      </p>

      {techDetails.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {techDetails.map((detail) => (
            <div
              key={detail.label}
              className={`p-4 bg-gray-900 border border-gray-800 rounded-lg ${
                detail.label === 'Deploy Command' || detail.label === 'Stack Notes'
                  ? 'md:col-span-2'
                  : ''
              }`}
            >
              <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">
                {detail.label}
              </p>
              <p
                className={`text-white text-sm whitespace-pre-wrap ${
                  detail.mono ? 'font-mono' : ''
                }`}
              >
                {detail.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Time Summary */}
      {(timeSummary.totalHours > 0) && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Time Summary</h3>
            {timeSummary.uninvoicedCost > 0 && (
              <form action={generateInvoiceFromTimeAction}>
                <input type="hidden" name="client_id" value={client.id} />
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  Generate Invoice
                </button>
              </form>
            )}
          </div>
          <TimeSummaryCard summary={timeSummary} />
        </div>
      )}

      <div className="mb-8">
        <DeliverableList
          clientId={client.id}
          projectId={project.id}
          deliverables={deliverables}
          deliverableHours={deliverableHours}
        />
      </div>

      {/* Log Time */}
      <div className="mb-8 p-4 bg-gray-900 border border-gray-800 rounded-lg">
        <TimeEntryForm
          clientId={client.id}
          projectId={project.id}
          deliverables={deliverables}
          defaultRate={project.hourly_rate}
        />
      </div>

      {/* Recent Time Entries */}
      {timeEntries.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Time Entries</h3>
          <TimeEntriesTable
            entries={timeEntries}
            deliverables={deliverables}
            clientId={client.id}
            projectId={project.id}
          />
        </div>
      )}

      <div className="mb-8">
        <ActivityLog
          clientId={client.id}
          projectId={project.id}
          activities={activities}
        />
      </div>

      <DeleteProjectButton projectId={project.id} clientId={client.id} />
    </div>
  );
}
```

- [ ] **Step 2: Update DeliverableList to accept and display hours**

In `src/components/deliverable-list.tsx`, update the interface and component:

Add `deliverableHours?: Record<number, number>;` to `DeliverableListProps`.

In the component signature, destructure: `{ clientId, projectId, deliverables, deliverableHours }`.

Inside each deliverable row, after the due date span, add:

```tsx
{deliverableHours?.[d.id] && (
  <span className="ml-2 text-xs text-blue-400">
    {deliverableHours[d.id].toFixed(1)}h
  </span>
)}
```

- [ ] **Step 3: Build to verify**

Run: `cd /Users/philipsmith/commandpost && npm run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/clients/\[id\]/projects/\[projectId\]/page.tsx src/components/deliverable-list.tsx
git commit -m "feat(time): integrate time tracking UI into project detail page"
```

---

### Task 8: Finances Time tab

**Files:**
- Modify: `src/components/finance-tabs.tsx`
- Create: `src/app/(dashboard)/finances/time/page.tsx`

- [ ] **Step 1: Add Time tab to finance-tabs.tsx**

In `src/components/finance-tabs.tsx`, add after the 'recurring' entry in the TABS array:

```typescript
  { key: 'time', label: 'Time' },
```

- [ ] **Step 2: Create finances time page**

Create `src/app/(dashboard)/finances/time/page.tsx`:

```tsx
import { getDb } from '@/lib/db';
import { getTimeStats, getTimeEntriesFiltered } from '@/lib/queries/time-queries';
import { FinanceTabs } from '@/components/finance-tabs';
import { generateInvoiceFromTimeAction } from '@/lib/actions/time-actions';

export const dynamic = 'force-dynamic';

export default async function FinancesTimePage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; project?: string; start?: string; end?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const db = getDb();
  const stats = getTimeStats(db);

  const filters: { clientId?: number; projectId?: number; startDate?: string; endDate?: string; invoiced?: boolean } = {};
  if (sp.client) filters.clientId = Number(sp.client);
  if (sp.project) filters.projectId = Number(sp.project);
  if (sp.start) filters.startDate = sp.start;
  if (sp.end) filters.endDate = sp.end;
  if (sp.status === 'invoiced') filters.invoiced = true;
  if (sp.status === 'uninvoiced') filters.invoiced = false;

  const entries = getTimeEntriesFiltered(db, filters);

  // Get clients and projects for filter dropdowns
  const clients = db.prepare("SELECT id, name FROM clients WHERE deleted_at IS NULL ORDER BY name").all() as { id: number; name: string }[];
  const projects = db.prepare("SELECT id, name FROM projects ORDER BY name").all() as { id: number; name: string }[];

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-bold mb-4">Finances</h1>
      <FinanceTabs active="time" />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Hours This Month</p>
          <p className="text-2xl font-bold text-white">{stats.hoursThisMonth.toFixed(1)}h</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Uninvoiced Total</p>
          <p className="text-2xl font-bold text-yellow-400">${stats.uninvoicedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Uninvoiced Hours</p>
          <p className="text-2xl font-bold text-yellow-400">{stats.uninvoicedHours.toFixed(1)}h</p>
        </div>
      </div>

      {/* Filters */}
      <form className="flex flex-wrap gap-3 mb-6">
        <select name="client" defaultValue={sp.client || ''} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
          <option value="">All Clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="project" defaultValue={sp.project || ''} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input type="date" name="start" defaultValue={sp.start || ''} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
        <input type="date" name="end" defaultValue={sp.end || ''} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
        <select name="status" defaultValue={sp.status || ''} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
          <option value="">All Status</option>
          <option value="uninvoiced">Uninvoiced</option>
          <option value="invoiced">Invoiced</option>
        </select>
        <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors">
          Filter
        </button>
      </form>

      {/* Entries Table */}
      {entries.length === 0 ? (
        <p className="text-gray-500 text-sm">No time entries found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-left">
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Client</th>
                <th className="pb-2 pr-4">Project</th>
                <th className="pb-2 pr-4">Deliverable</th>
                <th className="pb-2 pr-4 text-right">Duration</th>
                <th className="pb-2 pr-4 text-right">Rate</th>
                <th className="pb-2 pr-4 text-right">Amount</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const hours = entry.duration_minutes / 60;
                const amount = hours * entry.hourly_rate;
                return (
                  <tr key={entry.id} className="border-b border-gray-800/50">
                    <td className="py-2 pr-4 text-white">{entry.entry_date}</td>
                    <td className="py-2 pr-4 text-gray-300">{entry.client_name}</td>
                    <td className="py-2 pr-4 text-gray-300">{entry.project_name}</td>
                    <td className="py-2 pr-4 text-gray-300">{entry.deliverable_title || '—'}</td>
                    <td className="py-2 pr-4 text-right text-white">{hours.toFixed(2)}h</td>
                    <td className="py-2 pr-4 text-right text-gray-300">${entry.hourly_rate}</td>
                    <td className="py-2 pr-4 text-right text-white">${amount.toFixed(2)}</td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${entry.is_invoiced ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'}`}>
                        {entry.is_invoiced ? 'Invoiced' : 'Uninvoiced'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Generate Invoice button */}
      {sp.client && entries.some(e => !e.is_invoiced) && (
        <div className="mt-6">
          <form action={generateInvoiceFromTimeAction}>
            <input type="hidden" name="client_id" value={sp.client} />
            <button type="submit" className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors">
              Generate Invoice for Selected Client
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Build to verify**

Run: `cd /Users/philipsmith/commandpost && npm run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/components/finance-tabs.tsx src/app/\(dashboard\)/finances/time/page.tsx
git commit -m "feat(time): add Finances Time tab with filters and entries table"
```

---

### Task 9: Dashboard uninvoiced time metric

**Files:**
- Modify: `src/lib/queries/dashboard-queries.ts:6-52`
- Modify: `src/app/(dashboard)/page.tsx:32-65`

- [ ] **Step 1: Add uninvoicedTime to DashboardSummary**

In `src/lib/queries/dashboard-queries.ts`, add to the `DashboardSummary` interface:

```typescript
  uninvoicedTime: number;
```

In `getDashboardSummary`, add before the `return` statement:

```typescript
  const uninvoicedTime = (db.prepare("SELECT COALESCE(SUM(duration_minutes * hourly_rate / 60.0), 0) as total FROM time_entries WHERE is_invoiced = 0").get() as any).total;
```

Add `uninvoicedTime` to the return object.

- [ ] **Step 2: Show uninvoiced time on dashboard**

In `src/app/(dashboard)/page.tsx`, add after the "Servers" card (after line 63, before the closing `</div>` of the summary cards grid):

```tsx
        {summary.uninvoicedTime > 0 && (
          <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
            <p className="text-xs text-gray-500 uppercase mb-1">Uninvoiced Time</p>
            <p className="text-2xl font-bold text-yellow-400">${summary.uninvoicedTime.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
          </div>
        )}
```

- [ ] **Step 3: Build to verify**

Run: `cd /Users/philipsmith/commandpost && npm run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 4: Run all tests**

Run: `cd /Users/philipsmith/commandpost && npx vitest run 2>&1 | tail -30`
Expected: All tests pass (existing + new time-queries tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/dashboard-queries.ts src/app/\(dashboard\)/page.tsx
git commit -m "feat(time): add uninvoiced time metric to dashboard"
```

---

### Task 10: Final verification and full test run

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `cd /Users/philipsmith/commandpost && npx vitest run 2>&1`
Expected: All tests pass

- [ ] **Step 2: Run production build**

Run: `cd /Users/philipsmith/commandpost && npm run build 2>&1 | tail -30`
Expected: Build succeeds with no errors

- [ ] **Step 3: Manual smoke test**

Run: `cd /Users/philipsmith/commandpost && npm run dev &`
Then verify:
- `/clients/[id]/projects/[projectId]` shows time entry form and summary
- `/finances?tab=time` (or `/finances/time`) shows Time tab
- Dashboard shows when uninvoiced time exists

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(time): address any final build/test issues"
```
