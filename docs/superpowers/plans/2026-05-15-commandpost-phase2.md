# CommandPost Phase 2: Pipeline (Lead Tracking & Sales)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Kanban-style sales pipeline with lead CRUD, drag-and-drop stage changes, follow-up tracking, stage history, notes, lost reasons, and Won→Client conversion. Update dashboard to show pipeline data.

**Architecture:** Three new database tables (leads, lead_stage_history, lead_notes). Query layer + server actions following existing patterns. Kanban board uses HTML drag-and-drop API (no library). Dashboard queries extended to include pipeline stats and missed follow-ups.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS, better-sqlite3, HTML Drag and Drop API

**IMPORTANT Next.js 16 notes:**
- File `src/proxy.ts` (not middleware.ts) handles auth — export `proxy()` not `middleware()`
- `params` and `searchParams` in page components are Promises — use `await params`
- Server actions used with `useActionState` must accept `(prevState, formData)` as args
- Server actions passed directly to `<form action={}>` take `(formData)` only

---

## File Structure

```
src/
├── lib/
│   ├── db.ts                              # MODIFY: add leads, lead_stage_history, lead_notes tables
│   ├── types.ts                           # MODIFY: add Lead, LeadNote, LeadStageHistory interfaces
│   ├── queries/
│   │   ├── lead-queries.ts                # CREATE: lead CRUD + stage history queries
│   │   └── dashboard-queries.ts           # MODIFY: add pipeline stats + missed follow-ups
│   └── actions/
│       └── lead-actions.ts                # CREATE: lead server actions
├── components/
│   ├── kanban-board.tsx                   # CREATE: drag-and-drop kanban board
│   ├── kanban-card.tsx                    # CREATE: individual lead card
│   ├── lead-form.tsx                      # CREATE: reusable lead form
│   ├── lead-notes.tsx                     # CREATE: notes log component
│   ├── stage-history.tsx                  # CREATE: stage timeline component
│   └── convert-to-client.tsx              # CREATE: Won→Client conversion modal
├── app/(dashboard)/
│   ├── pipeline/
│   │   ├── page.tsx                       # CREATE: kanban board page
│   │   ├── new/
│   │   │   └── page.tsx                   # CREATE: new lead form
│   │   └── [id]/
│   │       ├── page.tsx                   # CREATE: lead detail page
│   │       └── edit/
│   │           └── page.tsx               # CREATE: edit lead form
│   └── page.tsx                           # MODIFY: add pipeline summary card
tests/
├── actions/
│   └── lead-actions.test.ts              # CREATE: lead query tests
└── queries/
    └── dashboard-queries.test.ts          # MODIFY: add pipeline dashboard tests
```

---

### Task 1: Database Schema — Add Pipeline Tables

**Files:**
- Modify: `src/lib/db.ts`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add Lead, LeadNote, LeadStageHistory interfaces to types.ts**

Add to the end of `src/lib/types.ts`:

```typescript
export type LostReason = 'too_expensive' | 'competitor' | 'timing' | 'ghosted' | 'other';

export interface Lead {
  id: number;
  business_name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  source: LeadSource;
  estimated_value: number | null;
  stage: LeadStage;
  lost_reason: LostReason | null;
  follow_up_date: string | null;
  created_at: string;
  updated_at: string;
  converted_client_id: number | null;
}

export interface LeadStageHistory {
  id: number;
  lead_id: number;
  stage: LeadStage;
  entered_at: string;
}

export interface LeadNote {
  id: number;
  lead_id: number;
  content: string;
  created_at: string;
}
```

- [ ] **Step 2: Add pipeline tables to db.ts**

Add these CREATE TABLE statements to the `db.exec()` call in `initDb()`, after the `activity_logs` table:

```sql
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  source TEXT NOT NULL DEFAULT 'other' CHECK(source IN ('referral','website','outbound','other')),
  estimated_value REAL,
  stage TEXT NOT NULL DEFAULT 'new' CHECK(stage IN ('new','contacted','discovery','proposal','negotiating','won','lost')),
  lost_reason TEXT CHECK(lost_reason IN ('too_expensive','competitor','timing','ghosted','other')),
  follow_up_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  converted_client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS lead_stage_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  entered_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lead_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- [ ] **Step 3: Verify tables are created**

```bash
cd /Users/philipsmith/commandpost && node -e "
const { initDb } = require('./src/lib/db');
const db = initDb('./data/test-schema.db');
const tables = db.prepare(\"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name\").all();
console.log(tables.map(t => t.name));
db.close();
require('fs').unlinkSync('./data/test-schema.db');
"
```

Expected: Array includes `leads`, `lead_stage_history`, `lead_notes`.

NOTE: This may not work with ESM/TypeScript. If so, run the existing tests instead:

```bash
cd /Users/philipsmith/commandpost && npx vitest run tests/lib/db.test.ts
```

Then update the db test to also check for the new tables.

- [ ] **Step 4: Update db test to verify new tables**

Add to the `'creates all required tables'` test in `tests/lib/db.test.ts`:

```typescript
expect(tables).toContain('leads');
expect(tables).toContain('lead_stage_history');
expect(tables).toContain('lead_notes');
```

- [ ] **Step 5: Run tests**

```bash
cd /Users/philipsmith/commandpost && npx vitest run tests/lib/db.test.ts
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/philipsmith/commandpost
git add src/lib/db.ts src/lib/types.ts tests/lib/db.test.ts
git commit -m "feat: add pipeline database tables and types (leads, stage history, notes)"
```

---

### Task 2: Lead Queries

**Files:**
- Create: `src/lib/queries/lead-queries.ts`
- Create: `tests/actions/lead-actions.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/actions/lead-actions.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initDb } from '@/lib/db';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-leads.db');

describe('lead queries', () => {
  let db: Database.Database;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    db = initDb(TEST_DB_PATH);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('creates a lead with initial stage history', async () => {
    const { createLead, getLeadById } = await import('@/lib/queries/lead-queries');
    const id = createLead(db, {
      business_name: 'Acme Corp',
      contact_person: 'John Doe',
      email: 'john@acme.com',
      source: 'referral',
      estimated_value: 5000,
    });
    expect(id).toBeGreaterThan(0);
    const lead = getLeadById(db, id);
    expect(lead!.business_name).toBe('Acme Corp');
    expect(lead!.stage).toBe('new');

    const history = db.prepare('SELECT * FROM lead_stage_history WHERE lead_id = ?').all(id) as any[];
    expect(history).toHaveLength(1);
    expect(history[0].stage).toBe('new');
  });

  it('lists leads grouped by stage', async () => {
    const { createLead, listLeadsByStage } = await import('@/lib/queries/lead-queries');
    createLead(db, { business_name: 'Lead A', source: 'referral' });
    createLead(db, { business_name: 'Lead B', source: 'website' });
    const byStage = listLeadsByStage(db);
    expect(byStage.new).toHaveLength(2);
    expect(byStage.contacted).toHaveLength(0);
  });

  it('updates lead stage and records history', async () => {
    const { createLead, updateLeadStage, getLeadById } = await import('@/lib/queries/lead-queries');
    const id = createLead(db, { business_name: 'Test Lead', source: 'outbound' });
    updateLeadStage(db, id, 'contacted');
    const lead = getLeadById(db, id);
    expect(lead!.stage).toBe('contacted');

    const history = db.prepare('SELECT * FROM lead_stage_history WHERE lead_id = ? ORDER BY entered_at').all(id) as any[];
    expect(history).toHaveLength(2);
    expect(history[0].stage).toBe('new');
    expect(history[1].stage).toBe('contacted');
  });

  it('marks lead as lost with reason', async () => {
    const { createLead, markLeadLost, getLeadById } = await import('@/lib/queries/lead-queries');
    const id = createLead(db, { business_name: 'Lost Lead', source: 'website' });
    markLeadLost(db, id, 'too_expensive');
    const lead = getLeadById(db, id);
    expect(lead!.stage).toBe('lost');
    expect(lead!.lost_reason).toBe('too_expensive');
  });

  it('adds and lists lead notes', async () => {
    const { createLead, addLeadNote, listLeadNotes } = await import('@/lib/queries/lead-queries');
    const id = createLead(db, { business_name: 'Note Lead', source: 'referral' });
    addLeadNote(db, id, 'Called, left voicemail');
    addLeadNote(db, id, 'Sent follow-up email');
    const notes = listLeadNotes(db, id);
    expect(notes).toHaveLength(2);
    expect(notes[0].content).toBe('Sent follow-up email');
  });

  it('gets pipeline summary', async () => {
    const { createLead, getPipelineSummary } = await import('@/lib/queries/lead-queries');
    createLead(db, { business_name: 'A', source: 'referral', estimated_value: 3000 });
    createLead(db, { business_name: 'B', source: 'website', estimated_value: 2000 });
    const summary = getPipelineSummary(db);
    expect(summary.totalLeads).toBe(2);
    expect(summary.totalValue).toBe(5000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/philipsmith/commandpost && npx vitest run tests/actions/lead-actions.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement lead queries**

Create `src/lib/queries/lead-queries.ts`:

```typescript
import type Database from 'better-sqlite3';
import type { Lead, LeadNote, LeadStageHistory, LeadStage, LeadSource, LostReason } from '@/lib/types';

interface CreateLeadInput {
  business_name: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  source: LeadSource;
  estimated_value?: number | null;
  follow_up_date?: string | null;
}

interface UpdateLeadInput {
  business_name?: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  source?: LeadSource;
  estimated_value?: number | null;
  follow_up_date?: string | null;
}

export interface PipelineSummary {
  totalLeads: number;
  totalValue: number;
  needsFollowUp: number;
}

export type LeadsByStage = Record<LeadStage, Lead[]>;

export function createLead(db: Database.Database, input: CreateLeadInput): number {
  const result = db.prepare(`
    INSERT INTO leads (business_name, contact_person, email, phone, website, source, estimated_value, follow_up_date)
    VALUES (@business_name, @contact_person, @email, @phone, @website, @source, @estimated_value, @follow_up_date)
  `).run({
    business_name: input.business_name,
    contact_person: input.contact_person ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    website: input.website ?? null,
    source: input.source,
    estimated_value: input.estimated_value ?? null,
    follow_up_date: input.follow_up_date ?? null,
  });

  const id = Number(result.lastInsertRowid);

  db.prepare('INSERT INTO lead_stage_history (lead_id, stage) VALUES (?, ?)').run(id, 'new');

  return id;
}

export function getLeadById(db: Database.Database, id: number): Lead | undefined {
  return db.prepare('SELECT * FROM leads WHERE id = ?').get(id) as Lead | undefined;
}

export function listLeadsByStage(db: Database.Database): LeadsByStage {
  const allLeads = db.prepare("SELECT * FROM leads WHERE stage != 'won' AND stage != 'lost' ORDER BY updated_at DESC").all() as Lead[];

  const stages: LeadStage[] = ['new', 'contacted', 'discovery', 'proposal', 'negotiating', 'won', 'lost'];
  const byStage: LeadsByStage = {} as LeadsByStage;
  for (const s of stages) {
    byStage[s] = [];
  }
  for (const lead of allLeads) {
    byStage[lead.stage].push(lead);
  }
  return byStage;
}

export function listAllLeads(db: Database.Database): Lead[] {
  return db.prepare('SELECT * FROM leads ORDER BY updated_at DESC').all() as Lead[];
}

export function updateLead(db: Database.Database, id: number, input: UpdateLeadInput): void {
  const fields: string[] = [];
  const params: any = { id };

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      fields.push(`${key} = @${key}`);
      params[key] = value;
    }
  }

  if (fields.length === 0) return;
  fields.push("updated_at = datetime('now')");

  db.prepare(`UPDATE leads SET ${fields.join(', ')} WHERE id = @id`).run(params);
}

export function updateLeadStage(db: Database.Database, id: number, stage: LeadStage): void {
  db.prepare("UPDATE leads SET stage = ?, updated_at = datetime('now') WHERE id = ?").run(stage, id);
  db.prepare('INSERT INTO lead_stage_history (lead_id, stage) VALUES (?, ?)').run(id, stage);
}

export function markLeadLost(db: Database.Database, id: number, reason: LostReason): void {
  db.prepare("UPDATE leads SET stage = 'lost', lost_reason = ?, updated_at = datetime('now') WHERE id = ?").run(reason, id);
  db.prepare("INSERT INTO lead_stage_history (lead_id, stage) VALUES (?, 'lost')").run(id);
}

export function markLeadWon(db: Database.Database, id: number, clientId: number): void {
  db.prepare("UPDATE leads SET stage = 'won', converted_client_id = ?, updated_at = datetime('now') WHERE id = ?").run(clientId, id);
  db.prepare("INSERT INTO lead_stage_history (lead_id, stage) VALUES (?, 'won')").run(id);
}

export function addLeadNote(db: Database.Database, leadId: number, content: string): number {
  const result = db.prepare('INSERT INTO lead_notes (lead_id, content) VALUES (?, ?)').run(leadId, content);
  db.prepare("UPDATE leads SET updated_at = datetime('now') WHERE id = ?").run(leadId);
  return Number(result.lastInsertRowid);
}

export function listLeadNotes(db: Database.Database, leadId: number): LeadNote[] {
  return db.prepare('SELECT * FROM lead_notes WHERE lead_id = ? ORDER BY created_at DESC').all(leadId) as LeadNote[];
}

export function getStageHistory(db: Database.Database, leadId: number): LeadStageHistory[] {
  return db.prepare('SELECT * FROM lead_stage_history WHERE lead_id = ? ORDER BY entered_at ASC').all(leadId) as LeadStageHistory[];
}

export function getPipelineSummary(db: Database.Database): PipelineSummary {
  const totalLeads = (db.prepare("SELECT COUNT(*) as count FROM leads WHERE stage NOT IN ('won','lost')").get() as any).count;
  const totalValue = (db.prepare("SELECT COALESCE(SUM(estimated_value), 0) as total FROM leads WHERE stage NOT IN ('won','lost')").get() as any).total;
  const needsFollowUp = (db.prepare("SELECT COUNT(*) as count FROM leads WHERE stage NOT IN ('won','lost') AND follow_up_date < date('now')").get() as any).count;
  return { totalLeads, totalValue, needsFollowUp };
}

export function deleteLead(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM leads WHERE id = ?').run(id);
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/philipsmith/commandpost && npx vitest run tests/actions/lead-actions.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/philipsmith/commandpost
git add src/lib/queries/lead-queries.ts tests/actions/lead-actions.test.ts
git commit -m "feat: add lead CRUD queries with stage history and pipeline summary"
```

---

### Task 3: Lead Server Actions

**Files:**
- Create: `src/lib/actions/lead-actions.ts`

- [ ] **Step 1: Create lead server actions**

Create `src/lib/actions/lead-actions.ts`:

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import {
  createLead,
  updateLead,
  updateLeadStage,
  markLeadLost,
  markLeadWon,
  addLeadNote,
  deleteLead,
} from '@/lib/queries/lead-queries';
import { createClient } from '@/lib/queries/client-queries';
import type { LeadStage, LeadSource, LostReason } from '@/lib/types';

export async function createLeadAction(formData: FormData) {
  const db = getDb();
  const id = createLead(db, {
    business_name: formData.get('business_name') as string,
    contact_person: (formData.get('contact_person') as string) || null,
    email: (formData.get('email') as string) || null,
    phone: (formData.get('phone') as string) || null,
    website: (formData.get('website') as string) || null,
    source: (formData.get('source') as LeadSource) || 'other',
    estimated_value: formData.get('estimated_value')
      ? Number(formData.get('estimated_value'))
      : null,
    follow_up_date: (formData.get('follow_up_date') as string) || null,
  });

  revalidatePath('/pipeline');
  redirect(`/pipeline/${id}`);
}

export async function updateLeadAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));

  updateLead(db, id, {
    business_name: formData.get('business_name') as string,
    contact_person: (formData.get('contact_person') as string) || null,
    email: (formData.get('email') as string) || null,
    phone: (formData.get('phone') as string) || null,
    website: (formData.get('website') as string) || null,
    source: (formData.get('source') as LeadSource) || 'other',
    estimated_value: formData.get('estimated_value')
      ? Number(formData.get('estimated_value'))
      : null,
    follow_up_date: (formData.get('follow_up_date') as string) || null,
  });

  revalidatePath('/pipeline');
  revalidatePath(`/pipeline/${id}`);
  redirect(`/pipeline/${id}`);
}

export async function updateLeadStageAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  const stage = formData.get('stage') as LeadStage;

  updateLeadStage(db, id, stage);

  revalidatePath('/pipeline');
  revalidatePath(`/pipeline/${id}`);
}

export async function markLeadLostAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  const reason = formData.get('lost_reason') as LostReason;

  markLeadLost(db, id, reason);

  revalidatePath('/pipeline');
  revalidatePath(`/pipeline/${id}`);
  redirect('/pipeline');
}

export async function convertLeadToClientAction(formData: FormData) {
  const db = getDb();
  const leadId = Number(formData.get('lead_id'));
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId) as any;

  if (!lead) return;

  const clientId = createClient(db, {
    name: lead.business_name,
    contact_person: lead.contact_person,
    email: lead.email,
    phone: lead.phone,
    source: lead.source,
    status: 'active',
    monthly_value: lead.estimated_value,
  });

  markLeadWon(db, leadId, clientId);

  revalidatePath('/pipeline');
  revalidatePath('/clients');
  redirect(`/clients/${clientId}`);
}

export async function addLeadNoteAction(formData: FormData) {
  const db = getDb();
  const leadId = Number(formData.get('lead_id'));
  const content = formData.get('content') as string;

  addLeadNote(db, leadId, content);

  revalidatePath(`/pipeline/${leadId}`);
}

export async function deleteLeadAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  deleteLead(db, id);
  revalidatePath('/pipeline');
  redirect('/pipeline');
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/philipsmith/commandpost
git add src/lib/actions/lead-actions.ts
git commit -m "feat: add lead server actions (CRUD, stage changes, Won conversion)"
```

---

### Task 4: Kanban Board UI

**Files:**
- Create: `src/components/kanban-board.tsx`
- Create: `src/components/kanban-card.tsx`
- Create: `src/app/(dashboard)/pipeline/page.tsx`

- [ ] **Step 1: Create kanban card component**

Create `src/components/kanban-card.tsx`:

```tsx
import Link from 'next/link';
import type { Lead } from '@/lib/types';

interface KanbanCardProps {
  lead: Lead;
  daysInStage: number;
}

export function KanbanCard({ lead, daysInStage }: KanbanCardProps) {
  const agingColor =
    daysInStage >= 10
      ? 'border-red-800 bg-red-900/10'
      : daysInStage >= 5
      ? 'border-yellow-800 bg-yellow-900/10'
      : 'border-gray-800 bg-gray-900';

  return (
    <Link
      href={`/pipeline/${lead.id}`}
      draggable="true"
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', String(lead.id));
        e.dataTransfer.effectAllowed = 'move';
      }}
      className={`block p-3 rounded-lg border ${agingColor} hover:border-gray-700 transition-colors cursor-grab active:cursor-grabbing`}
    >
      <p className="text-sm font-medium text-white truncate">{lead.business_name}</p>
      {lead.contact_person && (
        <p className="text-xs text-gray-400 truncate">{lead.contact_person}</p>
      )}
      <div className="flex items-center justify-between mt-2">
        {lead.estimated_value ? (
          <span className="text-xs text-green-400">${lead.estimated_value.toLocaleString()}</span>
        ) : (
          <span />
        )}
        <span className={`text-xs ${daysInStage >= 10 ? 'text-red-400' : daysInStage >= 5 ? 'text-yellow-400' : 'text-gray-500'}`}>
          {daysInStage}d
        </span>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Create kanban board component**

Create `src/components/kanban-board.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { KanbanCard } from '@/components/kanban-card';
import { updateLeadStageAction } from '@/lib/actions/lead-actions';
import type { Lead, LeadStage } from '@/lib/types';

interface KanbanBoardProps {
  leadsByStage: Record<string, Lead[]>;
  stageEnteredDates: Record<number, string>;
}

const COLUMNS: { stage: LeadStage; label: string }[] = [
  { stage: 'new', label: 'New' },
  { stage: 'contacted', label: 'Contacted' },
  { stage: 'discovery', label: 'Discovery Call' },
  { stage: 'proposal', label: 'Proposal Sent' },
  { stage: 'negotiating', label: 'Negotiating' },
];

function daysBetween(dateStr: string): number {
  const then = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
}

export function KanbanBoard({ leadsByStage, stageEnteredDates }: KanbanBoardProps) {
  const router = useRouter();

  async function handleDrop(e: React.DragEvent, targetStage: LeadStage) {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-blue-900/20');
    const leadId = e.dataTransfer.getData('text/plain');
    if (!leadId) return;

    const formData = new FormData();
    formData.set('id', leadId);
    formData.set('stage', targetStage);
    await updateLeadStageAction(formData);
    router.refresh();
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('bg-blue-900/20');
  }

  function handleDragLeave(e: React.DragEvent) {
    e.currentTarget.classList.remove('bg-blue-900/20');
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '70vh' }}>
      {COLUMNS.map(({ stage, label }) => {
        const leads = leadsByStage[stage] || [];
        return (
          <div
            key={stage}
            className="flex-shrink-0 w-64 bg-gray-900/50 rounded-lg border border-gray-800 transition-colors"
            onDrop={(e) => handleDrop(e, stage)}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <div className="p-3 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-300">{label}</h3>
                <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                  {leads.length}
                </span>
              </div>
            </div>
            <div className="p-2 space-y-2 min-h-[200px]">
              {leads.map((lead) => (
                <KanbanCard
                  key={lead.id}
                  lead={lead}
                  daysInStage={daysBetween(stageEnteredDates[lead.id] || lead.updated_at)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Create pipeline page**

Create `src/app/(dashboard)/pipeline/page.tsx`:

```tsx
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { listLeadsByStage, getPipelineSummary } from '@/lib/queries/lead-queries';
import { KanbanBoard } from '@/components/kanban-board';

export const dynamic = 'force-dynamic';

export default function PipelinePage() {
  const db = getDb();
  const leadsByStage = listLeadsByStage(db);
  const summary = getPipelineSummary(db);

  // Get latest stage entry dates for aging calculation
  const allLeadIds = Object.values(leadsByStage).flat().map((l) => l.id);
  const stageEnteredDates: Record<number, string> = {};
  for (const id of allLeadIds) {
    const latest = db.prepare(
      'SELECT entered_at FROM lead_stage_history WHERE lead_id = ? ORDER BY entered_at DESC LIMIT 1'
    ).get(id) as any;
    if (latest) stageEnteredDates[id] = latest.entered_at;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Pipeline</h2>
          <p className="text-sm text-gray-400">
            {summary.totalLeads} leads &middot; ${summary.totalValue.toLocaleString()} total value
            {summary.needsFollowUp > 0 && (
              <span className="text-yellow-400"> &middot; {summary.needsFollowUp} need follow-up</span>
            )}
          </p>
        </div>
        <Link
          href="/pipeline/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + New Lead
        </Link>
      </div>

      <KanbanBoard leadsByStage={leadsByStage} stageEnteredDates={stageEnteredDates} />
    </div>
  );
}
```

- [ ] **Step 4: Verify pipeline page renders**

```bash
cd /Users/philipsmith/commandpost && npm run build
```

Expected: Build succeeds, `/pipeline` route registered.

- [ ] **Step 5: Commit**

```bash
cd /Users/philipsmith/commandpost
git add src/components/kanban-board.tsx src/components/kanban-card.tsx "src/app/(dashboard)/pipeline/page.tsx"
git commit -m "feat: add kanban pipeline board with drag-and-drop"
```

---

### Task 5: Lead Detail, New, Edit Pages

**Files:**
- Create: `src/components/lead-form.tsx`
- Create: `src/components/lead-notes.tsx`
- Create: `src/components/stage-history.tsx`
- Create: `src/components/convert-to-client.tsx`
- Create: `src/app/(dashboard)/pipeline/new/page.tsx`
- Create: `src/app/(dashboard)/pipeline/[id]/page.tsx`
- Create: `src/app/(dashboard)/pipeline/[id]/edit/page.tsx`

- [ ] **Step 1: Create lead form**

Create `src/components/lead-form.tsx`:

```tsx
import type { Lead } from '@/lib/types';

interface LeadFormProps {
  action: (formData: FormData) => void;
  lead?: Lead;
  submitLabel: string;
}

export function LeadForm({ action, lead, submitLabel }: LeadFormProps) {
  return (
    <form action={action} className="space-y-4 max-w-lg">
      {lead && <input type="hidden" name="id" value={lead.id} />}

      <div>
        <label className="block text-sm text-gray-400 mb-1">Business Name *</label>
        <input type="text" name="business_name" required defaultValue={lead?.business_name}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Contact Person</label>
          <input type="text" name="contact_person" defaultValue={lead?.contact_person ?? ''}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Email</label>
          <input type="email" name="email" defaultValue={lead?.email ?? ''}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Phone</label>
          <input type="tel" name="phone" defaultValue={lead?.phone ?? ''}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Website</label>
          <input type="text" name="website" defaultValue={lead?.website ?? ''}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Source</label>
          <select name="source" defaultValue={lead?.source ?? 'other'}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500">
            <option value="referral">Referral</option>
            <option value="website">Website</option>
            <option value="outbound">Outbound</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Est. Value ($)</label>
          <input type="number" name="estimated_value" step="0.01" defaultValue={lead?.estimated_value ?? ''}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Follow-up Date</label>
          <input type="date" name="follow_up_date" defaultValue={lead?.follow_up_date ?? ''}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
        </div>
      </div>

      <button type="submit"
        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
        {submitLabel}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create lead notes component**

Create `src/components/lead-notes.tsx`:

```tsx
'use client';

import { useRef } from 'react';
import { addLeadNoteAction } from '@/lib/actions/lead-actions';
import type { LeadNote } from '@/lib/types';

interface LeadNotesProps {
  leadId: number;
  notes: LeadNote[];
}

export function LeadNotes({ leadId, notes }: LeadNotesProps) {
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    await addLeadNoteAction(formData);
    formRef.current?.reset();
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Notes</h3>

      <form ref={formRef} action={handleSubmit} className="mb-4 flex gap-2">
        <input type="hidden" name="lead_id" value={leadId} />
        <input type="text" name="content" required placeholder="Add a note — call, email, meeting..."
          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
        <button type="submit"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
          Add
        </button>
      </form>

      {notes.length === 0 ? (
        <p className="text-sm text-gray-500">No notes yet.</p>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <div key={note.id} className="flex gap-3 p-3 bg-gray-900 border border-gray-800 rounded-lg">
              <div className="w-1.5 h-1.5 rounded-full bg-gray-600 mt-2 shrink-0" />
              <div>
                <p className="text-sm text-white">{note.content}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(note.created_at + 'Z').toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create stage history component**

Create `src/components/stage-history.tsx`:

```tsx
import type { LeadStageHistory } from '@/lib/types';

const stageLabels: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  discovery: 'Discovery Call',
  proposal: 'Proposal Sent',
  negotiating: 'Negotiating',
  won: 'Won',
  lost: 'Lost',
};

export function StageHistory({ history }: { history: LeadStageHistory[] }) {
  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold mb-4">Stage History</h3>
      <div className="space-y-2">
        {history.map((entry, i) => (
          <div key={entry.id} className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${i === history.length - 1 ? 'bg-blue-400' : 'bg-gray-600'}`} />
            <span className="text-sm text-white">{stageLabels[entry.stage] || entry.stage}</span>
            <span className="text-xs text-gray-500">
              {new Date(entry.entered_at + 'Z').toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create convert-to-client component**

Create `src/components/convert-to-client.tsx`:

```tsx
'use client';

import { convertLeadToClientAction } from '@/lib/actions/lead-actions';

export function ConvertToClient({ leadId }: { leadId: number }) {
  return (
    <form action={convertLeadToClientAction}>
      <input type="hidden" name="lead_id" value={leadId} />
      <button
        type="submit"
        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
        onClick={(e) => {
          if (!confirm('Mark this lead as Won and create a new Client record?')) {
            e.preventDefault();
          }
        }}
      >
        Mark Won &amp; Convert to Client
      </button>
    </form>
  );
}
```

- [ ] **Step 5: Create new lead page**

Create `src/app/(dashboard)/pipeline/new/page.tsx`:

```tsx
import Link from 'next/link';
import { LeadForm } from '@/components/lead-form';
import { createLeadAction } from '@/lib/actions/lead-actions';

export default function NewLeadPage() {
  return (
    <div className="p-6">
      <Link href="/pipeline" className="text-sm text-gray-400 hover:text-white mb-4 inline-block">
        &larr; Back to Pipeline
      </Link>
      <h2 className="text-2xl font-bold mb-6">New Lead</h2>
      <LeadForm action={createLeadAction} submitLabel="Create Lead" />
    </div>
  );
}
```

- [ ] **Step 6: Create lead detail page**

Create `src/app/(dashboard)/pipeline/[id]/page.tsx`:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getLeadById, listLeadNotes, getStageHistory } from '@/lib/queries/lead-queries';
import { deleteLeadAction, markLeadLostAction } from '@/lib/actions/lead-actions';
import { StatusBadge } from '@/components/status-badge';
import { LeadNotes } from '@/components/lead-notes';
import { StageHistory } from '@/components/stage-history';
import { ConvertToClient } from '@/components/convert-to-client';

const stageLabels: Record<string, string> = {
  new: 'New', contacted: 'Contacted', discovery: 'Discovery Call',
  proposal: 'Proposal Sent', negotiating: 'Negotiating', won: 'Won', lost: 'Lost',
};

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const lead = getLeadById(db, Number(id));
  if (!lead) notFound();

  const notes = listLeadNotes(db, lead.id);
  const history = getStageHistory(db, lead.id);

  return (
    <div className="p-6">
      <Link href="/pipeline" className="text-sm text-gray-400 hover:text-white mb-4 inline-block">
        &larr; Back to Pipeline
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">{lead.business_name}</h2>
          {lead.contact_person && <p className="text-gray-400">{lead.contact_person}</p>}
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={lead.stage} />
          <Link href={`/pipeline/${lead.id}/edit`}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg hover:border-gray-600 transition-colors">
            Edit
          </Link>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Email</p>
          <p className="text-sm text-white">{lead.email || '—'}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Phone</p>
          <p className="text-sm text-white">{lead.phone || '—'}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Website</p>
          <p className="text-sm text-white">{lead.website || '—'}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Source</p>
          <p className="text-sm text-white capitalize">{lead.source}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Estimated Value</p>
          <p className="text-sm text-white">{lead.estimated_value ? `$${lead.estimated_value.toLocaleString()}` : '—'}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Follow-up Date</p>
          <p className={`text-sm ${lead.follow_up_date && new Date(lead.follow_up_date) < new Date() ? 'text-red-400' : 'text-white'}`}>
            {lead.follow_up_date || '—'}
          </p>
        </div>
      </div>

      {/* Actions for active leads */}
      {lead.stage !== 'won' && lead.stage !== 'lost' && (
        <div className="flex gap-3 mb-8">
          <ConvertToClient leadId={lead.id} />
          <details className="relative">
            <summary className="px-4 py-2 text-sm text-red-400 border border-red-900 rounded-lg hover:bg-red-900/20 cursor-pointer transition-colors list-none">
              Mark Lost
            </summary>
            <form action={markLeadLostAction}
              className="absolute top-full mt-2 left-0 bg-gray-900 border border-gray-800 rounded-lg p-4 z-10 w-64">
              <input type="hidden" name="id" value={lead.id} />
              <p className="text-sm text-gray-400 mb-2">Reason:</p>
              <select name="lost_reason" required
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white mb-3 focus:outline-none focus:border-blue-500">
                <option value="too_expensive">Too Expensive</option>
                <option value="competitor">Went with Competitor</option>
                <option value="timing">Bad Timing</option>
                <option value="ghosted">Ghosted</option>
                <option value="other">Other</option>
              </select>
              <button type="submit"
                className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors">
                Confirm Lost
              </button>
            </form>
          </details>
        </div>
      )}

      {/* Won/Lost info */}
      {lead.stage === 'won' && lead.converted_client_id && (
        <div className="p-4 bg-green-900/20 border border-green-800 rounded-lg mb-8">
          <p className="text-sm text-green-400">
            This lead was won and converted to{' '}
            <Link href={`/clients/${lead.converted_client_id}`} className="underline hover:text-green-300">
              Client #{lead.converted_client_id}
            </Link>
          </p>
        </div>
      )}

      {lead.stage === 'lost' && lead.lost_reason && (
        <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg mb-8">
          <p className="text-sm text-red-400">
            Lost reason: {lead.lost_reason.replace(/_/g, ' ')}
          </p>
        </div>
      )}

      <StageHistory history={history} />
      <LeadNotes leadId={lead.id} notes={notes} />

      {/* Delete */}
      <div className="mt-12 pt-6 border-t border-gray-800">
        <form action={deleteLeadAction}>
          <input type="hidden" name="id" value={lead.id} />
          <button type="submit"
            className="px-4 py-2 text-sm text-red-400 border border-red-900 rounded-lg hover:bg-red-900/20 transition-colors"
            onClick={(e) => { if (!confirm('Delete this lead?')) e.preventDefault(); }}>
            Delete Lead
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Create edit lead page**

Create `src/app/(dashboard)/pipeline/[id]/edit/page.tsx`:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getLeadById } from '@/lib/queries/lead-queries';
import { LeadForm } from '@/components/lead-form';
import { updateLeadAction } from '@/lib/actions/lead-actions';

export default async function EditLeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const lead = getLeadById(db, Number(id));
  if (!lead) notFound();

  return (
    <div className="p-6">
      <Link href={`/pipeline/${id}`} className="text-sm text-gray-400 hover:text-white mb-4 inline-block">
        &larr; Back to {lead.business_name}
      </Link>
      <h2 className="text-2xl font-bold mb-6">Edit Lead</h2>
      <LeadForm action={updateLeadAction} lead={lead} submitLabel="Save Changes" />
    </div>
  );
}
```

- [ ] **Step 8: Verify build**

```bash
cd /Users/philipsmith/commandpost && npm run build
```

Expected: Build succeeds with `/pipeline`, `/pipeline/new`, `/pipeline/[id]`, `/pipeline/[id]/edit` routes.

- [ ] **Step 9: Commit**

```bash
cd /Users/philipsmith/commandpost
git add src/components/lead-form.tsx src/components/lead-notes.tsx src/components/stage-history.tsx src/components/convert-to-client.tsx "src/app/(dashboard)/pipeline/"
git commit -m "feat: add lead detail, new, and edit pages with notes and stage history"
```

---

### Task 6: Update Dashboard with Pipeline Data

**Files:**
- Modify: `src/lib/queries/dashboard-queries.ts`
- Modify: `src/app/(dashboard)/page.tsx`
- Modify: `tests/queries/dashboard-queries.test.ts`

- [ ] **Step 1: Add pipeline data to dashboard queries**

Add to `DashboardSummary` interface in `src/lib/queries/dashboard-queries.ts`:

```typescript
  pipelineLeads: number;
  pipelineValue: number;
  needsFollowUp: number;
```

Add to `ActionItem` type union:

```typescript
export interface ActionItem {
  type: 'overdue_deliverable' | 'due_soon_deliverable' | 'missed_follow_up';
  title: string;
  link: string;
  urgency: 'red' | 'yellow';
}
```

Update `getDashboardSummary` to add pipeline stats after the existing queries:

```typescript
  const pipelineLeads = (db.prepare("SELECT COUNT(*) as count FROM leads WHERE stage NOT IN ('won','lost')").get() as any).count;
  const pipelineValue = (db.prepare("SELECT COALESCE(SUM(estimated_value), 0) as total FROM leads WHERE stage NOT IN ('won','lost')").get() as any).total;
  const needsFollowUp = (db.prepare("SELECT COUNT(*) as count FROM leads WHERE stage NOT IN ('won','lost') AND follow_up_date < date('now')").get() as any).count;

  return { activeClients, overdueDeliverables, monthlyRevenue, pipelineLeads, pipelineValue, needsFollowUp };
```

Add missed follow-ups to `getActionItems`, after the due-soon section:

```typescript
  // Missed lead follow-ups
  const missedFollowUps = db.prepare(`
    SELECT id, business_name, contact_person, follow_up_date
    FROM leads
    WHERE stage NOT IN ('won','lost') AND follow_up_date < date('now')
    ORDER BY follow_up_date ASC
  `).all() as any[];

  for (const lead of missedFollowUps) {
    items.push({
      type: 'missed_follow_up',
      title: `Follow up: ${lead.business_name}${lead.contact_person ? ` (${lead.contact_person})` : ''} — was due ${lead.follow_up_date}`,
      link: `/pipeline/${lead.id}`,
      urgency: 'yellow',
    });
  }
```

- [ ] **Step 2: Update dashboard page's Pipeline card**

In `src/app/(dashboard)/page.tsx`, replace the Pipeline placeholder card:

```tsx
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Pipeline</p>
          <p className="text-2xl font-bold text-white">{summary.pipelineLeads}</p>
          <p className="text-xs text-gray-500">${summary.pipelineValue.toLocaleString()} value</p>
        </div>
```

- [ ] **Step 3: Add follow-up test to dashboard tests**

Add to `tests/queries/dashboard-queries.test.ts`:

```typescript
  it('includes missed follow-ups in action items', async () => {
    const { getActionItems } = await import('@/lib/queries/dashboard-queries');

    db.prepare("INSERT INTO leads (business_name, source, stage, follow_up_date) VALUES (?, ?, ?, ?)").run('Stale Lead', 'referral', 'contacted', '2025-01-01');

    const items = getActionItems(db);
    const followUps = items.filter(i => i.type === 'missed_follow_up');
    expect(followUps).toHaveLength(1);
    expect(followUps[0].title).toContain('Stale Lead');
  });
```

- [ ] **Step 4: Run all tests**

```bash
cd /Users/philipsmith/commandpost && npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/philipsmith/commandpost
git add src/lib/queries/dashboard-queries.ts "src/app/(dashboard)/page.tsx" tests/queries/dashboard-queries.test.ts
git commit -m "feat: add pipeline stats and missed follow-ups to dashboard"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/philipsmith/commandpost && npx vitest run
```

Expected: All tests pass.

- [ ] **Step 2: Production build**

```bash
cd /Users/philipsmith/commandpost && npm run build
```

Expected: Clean build with all pipeline routes registered.

- [ ] **Step 3: Manual smoke test**

Start dev server and test:
1. Navigate to Pipeline — empty kanban board
2. Create a new lead with all fields
3. Lead appears in "New" column
4. Drag lead to "Contacted" column — card moves
5. Click into lead detail — see info grid, stage history shows New → Contacted
6. Add notes
7. Edit lead details
8. Set a follow-up date in the past — dashboard should show it as action item
9. Click "Mark Won & Convert to Client" — creates client, redirects to client page
10. Create another lead, mark it Lost with a reason
11. Dashboard pipeline card shows correct counts

- [ ] **Step 4: Commit any fixes**

```bash
cd /Users/philipsmith/commandpost
git status
# If fixes needed:
git add -A && git commit -m "fix: adjustments from pipeline smoke testing"
```

---

## Phase 2 Complete

After this phase you have:
- Kanban board with 5 active columns (New → Contacted → Discovery → Proposal → Negotiating)
- Drag-and-drop stage changes
- Visual aging on cards (yellow at 5 days, red at 10)
- Lead CRUD with detail/edit pages
- Notes log on each lead
- Full stage history timeline
- Follow-up date tracking with dashboard alerts
- Mark Lost with reason selection
- Mark Won with automatic Client creation (pre-fills from lead data)
- Dashboard updated: pipeline count, value, missed follow-ups

## Next Phases
- **Phase 3:** Finances (invoices, Stripe, revenue dashboard, expenses, profitability)
- **Phase 4:** Ops Monitor (health checks, incident tracking)
- **Phase 5:** SMS Alerts (Twilio, morning briefing, scheduled summaries)
