# Proposals & Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create structured proposals with shareable links, simple acceptance flow that auto-converts leads to clients/projects/contracts.

**Architecture:** New proposals, proposal_items, and contracts tables. Admin CRUD pages for proposals + contracts list. Public proposal view with accept button. API route handles acceptance logic (lead conversion, project creation, contract creation).

**Tech Stack:** Next.js 16 App Router, better-sqlite3, Tailwind CSS v4, Vitest

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/lib/db.ts` | Add proposals, proposal_items, contracts tables |
| `src/lib/types.ts` | Add NotificationType entries |
| `src/lib/queries/proposal-queries.ts` | Proposal CRUD + token lookup |
| `src/lib/queries/contract-queries.ts` | Contract CRUD + expiry queries |
| `src/lib/actions/proposal-actions.ts` | Server actions for proposal management |
| `src/app/(dashboard)/proposals/page.tsx` | Proposals list |
| `src/app/(dashboard)/proposals/new/page.tsx` | Proposal builder form |
| `src/app/(dashboard)/proposals/[id]/page.tsx` | Proposal detail |
| `src/app/(dashboard)/contracts/page.tsx` | Contracts list |
| `src/app/proposals/view/[token]/page.tsx` | Public proposal view |
| `src/app/api/proposals/[token]/accept/route.ts` | Acceptance API endpoint |
| `src/components/proposal-items-form.tsx` | Client component for dynamic line items |
| `src/components/sidebar.tsx` | Add Proposals nav item |
| `src/components/mobile-nav.tsx` | Add Proposals nav item |
| `src/app/api/cron/notifications/route.ts` | Add contract expiry check |
| `tests/queries/proposal-queries.test.ts` | Proposal query tests |
| `tests/queries/contract-queries.test.ts` | Contract query tests |

---

### Task 1: Database Schema

**Files:**
- Modify: `src/lib/db.ts`

- [ ] **Step 1: Add tables to db.ts**

In `src/lib/db.ts`, add these tables inside the `db.exec()` block, after the `notification_preferences` table:

```typescript
    CREATE TABLE IF NOT EXISTS proposals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      scope TEXT,
      timeline TEXT,
      valid_until TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','accepted','rejected','expired')),
      token TEXT UNIQUE,
      accepted_at TEXT,
      accepted_ip TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS proposal_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      amount REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      proposal_id INTEGER REFERENCES proposals(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      terms_summary TEXT,
      signed_at TEXT NOT NULL,
      expires_at TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','expired','renewed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
```

- [ ] **Step 2: Add notification types to types.ts**

In `src/lib/types.ts`, add `'proposal_accepted'` and `'contract_expiring'` to the `NotificationType` union.

- [ ] **Step 3: Verify**

Run: `npx vitest run tests/queries/notification-queries.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/db.ts src/lib/types.ts
git commit -m "feat(proposals): add proposals, proposal_items, contracts tables and notification types"
```

---

### Task 2: Proposal Queries + Tests

**Files:**
- Create: `src/lib/queries/proposal-queries.ts`
- Create: `tests/queries/proposal-queries.test.ts`

- [ ] **Step 1: Create test file**

Create `tests/queries/proposal-queries.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { initDb } from '@/lib/db';
import {
  createProposal,
  getProposalById,
  listProposals,
  getProposalByToken,
  markProposalSent,
  updateProposalStatus,
  addProposalItem,
  getProposalItems,
  getProposalTotal,
} from '@/lib/queries/proposal-queries';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeEach(() => {
  db = initDb(':memory:');
  db.prepare("INSERT INTO leads (business_name, stage) VALUES ('Acme Corp', 'proposal')").run();
  db.prepare("INSERT INTO clients (name, status) VALUES ('Existing Co', 'active')").run();
});

describe('createProposal', () => {
  it('creates a proposal and returns id', () => {
    const id = createProposal(db, { title: 'Website Build', lead_id: 1, scope: 'Full site', timeline: '4 weeks', valid_until: '2026-07-01' });
    expect(id).toBe(1);
  });
});

describe('getProposalById', () => {
  it('returns proposal with lead/client name', () => {
    createProposal(db, { title: 'Website Build', lead_id: 1, scope: null, timeline: null, valid_until: null });
    const p = getProposalById(db, 1);
    expect(p).toBeDefined();
    expect(p!.title).toBe('Website Build');
    expect(p!.lead_name).toBe('Acme Corp');
  });
});

describe('listProposals', () => {
  it('lists all proposals', () => {
    createProposal(db, { title: 'P1', lead_id: 1, scope: null, timeline: null, valid_until: null });
    createProposal(db, { title: 'P2', client_id: 1, scope: null, timeline: null, valid_until: null });
    const list = listProposals(db);
    expect(list).toHaveLength(2);
  });

  it('filters by status', () => {
    createProposal(db, { title: 'P1', lead_id: 1, scope: null, timeline: null, valid_until: null });
    const list = listProposals(db, 'sent');
    expect(list).toHaveLength(0);
  });
});

describe('markProposalSent', () => {
  it('sets status to sent and generates token', () => {
    createProposal(db, { title: 'P1', lead_id: 1, scope: null, timeline: null, valid_until: null });
    const token = markProposalSent(db, 1);
    expect(token).toMatch(/^[0-9a-f-]{36}$/);
    const p = getProposalById(db, 1);
    expect(p!.status).toBe('sent');
  });
});

describe('getProposalByToken', () => {
  it('returns proposal for valid token', () => {
    createProposal(db, { title: 'P1', lead_id: 1, scope: null, timeline: null, valid_until: null });
    const token = markProposalSent(db, 1);
    const p = getProposalByToken(db, token);
    expect(p).toBeDefined();
    expect(p!.title).toBe('P1');
  });

  it('returns undefined for bad token', () => {
    expect(getProposalByToken(db, 'invalid')).toBeUndefined();
  });
});

describe('proposal items', () => {
  it('adds items and calculates total', () => {
    createProposal(db, { title: 'P1', lead_id: 1, scope: null, timeline: null, valid_until: null });
    addProposalItem(db, 1, { description: 'Design', quantity: 1, unit_price: 2000, amount: 2000 });
    addProposalItem(db, 1, { description: 'Dev', quantity: 10, unit_price: 150, amount: 1500 });
    const items = getProposalItems(db, 1);
    expect(items).toHaveLength(2);
    expect(getProposalTotal(db, 1)).toBe(3500);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/queries/proposal-queries.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement proposal queries**

Create `src/lib/queries/proposal-queries.ts`:

```typescript
import type Database from 'better-sqlite3';
import crypto from 'crypto';

interface CreateProposalInput {
  title: string;
  lead_id?: number | null;
  client_id?: number | null;
  scope: string | null;
  timeline: string | null;
  valid_until: string | null;
}

interface ProposalItemInput {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export interface ProposalRow {
  id: number;
  lead_id: number | null;
  client_id: number | null;
  title: string;
  scope: string | null;
  timeline: string | null;
  valid_until: string | null;
  status: string;
  token: string | null;
  accepted_at: string | null;
  accepted_ip: string | null;
  created_at: string;
  updated_at: string;
  lead_name: string | null;
  client_name: string | null;
  total_amount: number;
}

export interface ProposalItem {
  id: number;
  proposal_id: number;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export function createProposal(db: Database.Database, input: CreateProposalInput): number {
  const result = db.prepare(`
    INSERT INTO proposals (title, lead_id, client_id, scope, timeline, valid_until)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(input.title, input.lead_id ?? null, input.client_id ?? null, input.scope, input.timeline, input.valid_until);
  return Number(result.lastInsertRowid);
}

export function getProposalById(db: Database.Database, id: number): ProposalRow | undefined {
  const row = db.prepare(`
    SELECT p.*,
      l.business_name as lead_name,
      c.name as client_name,
      COALESCE((SELECT SUM(amount) FROM proposal_items WHERE proposal_id = p.id), 0) as total_amount
    FROM proposals p
    LEFT JOIN leads l ON p.lead_id = l.id
    LEFT JOIN clients c ON p.client_id = c.id
    WHERE p.id = ?
  `).get(id) as ProposalRow | undefined;
  return row;
}

export function listProposals(db: Database.Database, status?: string): ProposalRow[] {
  let sql = `
    SELECT p.*,
      l.business_name as lead_name,
      c.name as client_name,
      COALESCE((SELECT SUM(amount) FROM proposal_items WHERE proposal_id = p.id), 0) as total_amount
    FROM proposals p
    LEFT JOIN leads l ON p.lead_id = l.id
    LEFT JOIN clients c ON p.client_id = c.id
  `;
  const params: any[] = [];
  if (status) {
    sql += ' WHERE p.status = ?';
    params.push(status);
  }
  sql += ' ORDER BY p.created_at DESC';
  return db.prepare(sql).all(...params) as ProposalRow[];
}

export function getProposalByToken(db: Database.Database, token: string): ProposalRow | undefined {
  const row = db.prepare(`
    SELECT p.*,
      l.business_name as lead_name,
      c.name as client_name,
      COALESCE((SELECT SUM(amount) FROM proposal_items WHERE proposal_id = p.id), 0) as total_amount
    FROM proposals p
    LEFT JOIN leads l ON p.lead_id = l.id
    LEFT JOIN clients c ON p.client_id = c.id
    WHERE p.token = ?
  `).get(token) as ProposalRow | undefined;
  return row;
}

export function markProposalSent(db: Database.Database, id: number): string {
  const existing = db.prepare('SELECT token FROM proposals WHERE id = ?').get(id) as { token: string | null } | undefined;
  const token = existing?.token || crypto.randomUUID();
  db.prepare("UPDATE proposals SET status = 'sent', token = ?, updated_at = datetime('now') WHERE id = ?").run(token, id);
  return token;
}

export function updateProposalStatus(db: Database.Database, id: number, status: string): void {
  db.prepare("UPDATE proposals SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
}

export function addProposalItem(db: Database.Database, proposalId: number, item: ProposalItemInput): number {
  const result = db.prepare(`
    INSERT INTO proposal_items (proposal_id, description, quantity, unit_price, amount)
    VALUES (?, ?, ?, ?, ?)
  `).run(proposalId, item.description, item.quantity, item.unit_price, item.amount);
  return Number(result.lastInsertRowid);
}

export function getProposalItems(db: Database.Database, proposalId: number): ProposalItem[] {
  return db.prepare('SELECT * FROM proposal_items WHERE proposal_id = ? ORDER BY id').all(proposalId) as ProposalItem[];
}

export function getProposalTotal(db: Database.Database, proposalId: number): number {
  const row = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM proposal_items WHERE proposal_id = ?').get(proposalId) as { total: number };
  return row.total;
}

export function deleteProposalItems(db: Database.Database, proposalId: number): void {
  db.prepare('DELETE FROM proposal_items WHERE proposal_id = ?').run(proposalId);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/queries/proposal-queries.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/proposal-queries.ts tests/queries/proposal-queries.test.ts
git commit -m "feat(proposals): add proposal queries with tests"
```

---

### Task 3: Contract Queries + Tests

**Files:**
- Create: `src/lib/queries/contract-queries.ts`
- Create: `tests/queries/contract-queries.test.ts`

- [ ] **Step 1: Create test file**

Create `tests/queries/contract-queries.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { initDb } from '@/lib/db';
import {
  createContract,
  listContracts,
  getExpiringContracts,
} from '@/lib/queries/contract-queries';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeEach(() => {
  db = initDb(':memory:');
  db.prepare("INSERT INTO clients (name, status) VALUES ('Acme', 'active')").run();
});

describe('createContract', () => {
  it('creates a contract and returns id', () => {
    const id = createContract(db, {
      client_id: 1,
      proposal_id: null,
      title: 'Website Contract',
      terms_summary: 'Build a website',
      signed_at: '2026-05-16',
      expires_at: '2027-05-16',
    });
    expect(id).toBe(1);
  });
});

describe('listContracts', () => {
  it('lists contracts with client name', () => {
    createContract(db, { client_id: 1, proposal_id: null, title: 'C1', terms_summary: null, signed_at: '2026-05-16', expires_at: null });
    const list = listContracts(db);
    expect(list).toHaveLength(1);
    expect(list[0].client_name).toBe('Acme');
  });
});

describe('getExpiringContracts', () => {
  it('returns contracts expiring within N days', () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    createContract(db, { client_id: 1, proposal_id: null, title: 'Expiring', terms_summary: null, signed_at: '2026-01-01', expires_at: tomorrow });
    createContract(db, { client_id: 1, proposal_id: null, title: 'Not expiring', terms_summary: null, signed_at: '2026-01-01', expires_at: '2028-01-01' });
    const expiring = getExpiringContracts(db, 30);
    expect(expiring).toHaveLength(1);
    expect(expiring[0].title).toBe('Expiring');
  });
});
```

- [ ] **Step 2: Implement contract queries**

Create `src/lib/queries/contract-queries.ts`:

```typescript
import type Database from 'better-sqlite3';

interface CreateContractInput {
  client_id: number;
  proposal_id: number | null;
  title: string;
  terms_summary: string | null;
  signed_at: string;
  expires_at: string | null;
}

export interface ContractRow {
  id: number;
  client_id: number;
  proposal_id: number | null;
  title: string;
  terms_summary: string | null;
  signed_at: string;
  expires_at: string | null;
  status: string;
  created_at: string;
  client_name: string;
}

export function createContract(db: Database.Database, input: CreateContractInput): number {
  const result = db.prepare(`
    INSERT INTO contracts (client_id, proposal_id, title, terms_summary, signed_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(input.client_id, input.proposal_id, input.title, input.terms_summary, input.signed_at, input.expires_at);
  return Number(result.lastInsertRowid);
}

export function listContracts(db: Database.Database): ContractRow[] {
  return db.prepare(`
    SELECT ct.*, c.name as client_name
    FROM contracts ct
    JOIN clients c ON ct.client_id = c.id
    ORDER BY ct.created_at DESC
  `).all() as ContractRow[];
}

export function getExpiringContracts(db: Database.Database, withinDays: number): ContractRow[] {
  return db.prepare(`
    SELECT ct.*, c.name as client_name
    FROM contracts ct
    JOIN clients c ON ct.client_id = c.id
    WHERE ct.status = 'active'
      AND ct.expires_at IS NOT NULL
      AND ct.expires_at <= date('now', '+' || ? || ' days')
      AND ct.expires_at >= date('now')
    ORDER BY ct.expires_at ASC
  `).all(withinDays) as ContractRow[];
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/queries/contract-queries.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/queries/contract-queries.ts tests/queries/contract-queries.test.ts
git commit -m "feat(proposals): add contract queries with tests"
```

---

### Task 4: Server Actions

**Files:**
- Create: `src/lib/actions/proposal-actions.ts`

- [ ] **Step 1: Create proposal actions**

Create `src/lib/actions/proposal-actions.ts`:

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import {
  createProposal,
  markProposalSent,
  updateProposalStatus,
  addProposalItem,
  deleteProposalItems,
} from '@/lib/queries/proposal-queries';

export async function createProposalAction(formData: FormData) {
  const db = getDb();

  const title = formData.get('title') as string;
  const leadId = formData.get('lead_id') ? Number(formData.get('lead_id')) : null;
  const clientId = formData.get('client_id') ? Number(formData.get('client_id')) : null;
  const scope = (formData.get('scope') as string) || null;
  const timeline = (formData.get('timeline') as string) || null;
  const validUntil = (formData.get('valid_until') as string) || null;

  const proposalId = createProposal(db, { title, lead_id: leadId, client_id: clientId, scope, timeline, valid_until: validUntil });

  // Parse line items from form
  const descriptions = formData.getAll('item_description') as string[];
  const quantities = formData.getAll('item_quantity') as string[];
  const unitPrices = formData.getAll('item_unit_price') as string[];

  for (let i = 0; i < descriptions.length; i++) {
    if (!descriptions[i]) continue;
    const quantity = Number(quantities[i]) || 1;
    const unitPrice = Number(unitPrices[i]) || 0;
    const amount = Math.round(quantity * unitPrice * 100) / 100;
    addProposalItem(db, proposalId, { description: descriptions[i], quantity, unit_price: unitPrice, amount });
  }

  revalidatePath('/proposals');
  redirect(`/proposals/${proposalId}`);
}

export async function markProposalSentAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  markProposalSent(db, id);
  revalidatePath('/proposals');
  revalidatePath(`/proposals/${id}`);
  redirect(`/proposals/${id}`);
}

export async function markProposalRejectedAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  updateProposalStatus(db, id, 'rejected');
  revalidatePath('/proposals');
  revalidatePath(`/proposals/${id}`);
  redirect(`/proposals/${id}`);
}
```

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/proposal-actions.ts
git commit -m "feat(proposals): add server actions for proposal management"
```

---

### Task 5: Proposals List + New Proposal Pages

**Files:**
- Create: `src/app/(dashboard)/proposals/page.tsx`
- Create: `src/app/(dashboard)/proposals/new/page.tsx`
- Create: `src/components/proposal-items-form.tsx`

- [ ] **Step 1: Create proposals list page**

Create `src/app/(dashboard)/proposals/page.tsx`:

```typescript
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { listProposals } from '@/lib/queries/proposal-queries';
import { StatusBadge } from '@/components/status-badge';

export const dynamic = 'force-dynamic';

export default async function ProposalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const db = getDb();
  const proposals = listProposals(db, sp.status || undefined);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Proposals</h1>
        <Link href="/proposals/new" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors">
          New Proposal
        </Link>
      </div>

      <form className="flex gap-3 mb-6">
        <select name="status" defaultValue={sp.status || ''} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="expired">Expired</option>
        </select>
        <button type="submit" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors">Filter</button>
      </form>

      {proposals.length === 0 ? (
        <p className="text-gray-500 text-sm">No proposals found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-left">
                <th className="p-3">Title</th>
                <th className="p-3">For</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Status</th>
                <th className="p-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((p) => (
                <tr key={p.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                  <td className="p-3">
                    <Link href={`/proposals/${p.id}`} className="text-white hover:text-blue-400">{p.title}</Link>
                  </td>
                  <td className="p-3 text-gray-400">{p.lead_name || p.client_name || '—'}</td>
                  <td className="p-3 text-white">${p.total_amount.toLocaleString()}</td>
                  <td className="p-3"><StatusBadge status={p.status} /></td>
                  <td className="p-3 text-gray-500">{p.created_at.slice(0, 10)}</td>
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

- [ ] **Step 2: Create proposal items form component**

Create `src/components/proposal-items-form.tsx`:

```typescript
'use client';

import { useState } from 'react';

interface Item {
  description: string;
  quantity: string;
  unit_price: string;
}

export function ProposalItemsForm() {
  const [items, setItems] = useState<Item[]>([{ description: '', quantity: '1', unit_price: '' }]);

  function addItem() {
    setItems([...items, { description: '', quantity: '1', unit_price: '' }]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof Item, value: string) {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  }

  const total = items.reduce((sum, item) => {
    return sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
  }, 0);

  return (
    <div>
      <label className="block text-sm text-gray-400 mb-2">Line Items</label>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="text"
              name="item_description"
              value={item.description}
              onChange={(e) => updateItem(i, 'description', e.target.value)}
              placeholder="Description"
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
            />
            <input
              type="number"
              name="item_quantity"
              value={item.quantity}
              onChange={(e) => updateItem(i, 'quantity', e.target.value)}
              placeholder="Qty"
              step="0.01"
              className="w-20 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
            />
            <input
              type="number"
              name="item_unit_price"
              value={item.unit_price}
              onChange={(e) => updateItem(i, 'unit_price', e.target.value)}
              placeholder="Rate"
              step="0.01"
              className="w-24 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
            />
            <span className="w-24 px-3 py-2 text-white text-sm text-right">
              ${((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)).toLocaleString()}
            </span>
            {items.length > 1 && (
              <button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-300 px-2">×</button>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-3">
        <button type="button" onClick={addItem} className="text-sm text-blue-400 hover:text-blue-300">+ Add Item</button>
        <span className="text-white font-medium">Total: ${total.toLocaleString()}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create new proposal page**

Create `src/app/(dashboard)/proposals/new/page.tsx`:

```typescript
import { getDb } from '@/lib/db';
import { createProposalAction } from '@/lib/actions/proposal-actions';
import { ProposalItemsForm } from '@/components/proposal-items-form';

export const dynamic = 'force-dynamic';

export default function NewProposalPage() {
  const db = getDb();
  const leads = db.prepare("SELECT id, business_name FROM leads WHERE stage NOT IN ('won','lost') ORDER BY business_name").all() as { id: number; business_name: string }[];
  const clients = db.prepare("SELECT id, name FROM clients WHERE status = 'active' AND deleted_at IS NULL ORDER BY name").all() as { id: number; name: string }[];

  return (
    <div className="p-4 sm:p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">New Proposal</h1>
      <form action={createProposalAction} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Title</label>
          <input type="text" name="title" required className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Lead</label>
            <select name="lead_id" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
              <option value="">None</option>
              {leads.map(l => <option key={l.id} value={l.id}>{l.business_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Or Client</label>
            <select name="client_id" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
              <option value="">None</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Scope</label>
          <textarea name="scope" rows={4} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Timeline</label>
            <input type="text" name="timeline" placeholder="e.g. 4-6 weeks" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Valid Until</label>
            <input type="date" name="valid_until" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
          </div>
        </div>
        <ProposalItemsForm />
        <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors">
          Save as Draft
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Build to verify**

Run: `npm run build 2>&1 | grep -E "(error|/proposals)"`
Expected: routes listed, no errors

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/proposals/page.tsx src/app/\(dashboard\)/proposals/new/page.tsx src/components/proposal-items-form.tsx
git commit -m "feat(proposals): add proposals list and new proposal pages"
```

---

### Task 6: Proposal Detail Page

**Files:**
- Create: `src/app/(dashboard)/proposals/[id]/page.tsx`

- [ ] **Step 1: Create detail page**

Create `src/app/(dashboard)/proposals/[id]/page.tsx`:

```typescript
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getProposalById, getProposalItems } from '@/lib/queries/proposal-queries';
import { markProposalSentAction, markProposalRejectedAction } from '@/lib/actions/proposal-actions';
import { StatusBadge } from '@/components/status-badge';

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const proposal = getProposalById(db, Number(id));
  if (!proposal) notFound();

  const items = getProposalItems(db, Number(id));
  const portalUrl = proposal.token ? `/proposals/view/${proposal.token}` : null;

  return (
    <div className="p-4 sm:p-6 max-w-3xl">
      <Link href="/proposals" className="text-sm text-gray-400 hover:text-white mb-4 inline-block">&larr; Back to Proposals</Link>

      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">{proposal.title}</h1>
        <StatusBadge status={proposal.status} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-3 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-gray-500 text-xs uppercase">For</p>
          <p className="text-white text-sm">{proposal.lead_name || proposal.client_name || '—'}</p>
        </div>
        <div className="p-3 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-gray-500 text-xs uppercase">Timeline</p>
          <p className="text-white text-sm">{proposal.timeline || '—'}</p>
        </div>
        <div className="p-3 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-gray-500 text-xs uppercase">Valid Until</p>
          <p className="text-white text-sm">{proposal.valid_until || '—'}</p>
        </div>
        <div className="p-3 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-gray-500 text-xs uppercase">Total</p>
          <p className="text-white text-sm font-medium">${proposal.total_amount.toLocaleString()}</p>
        </div>
      </div>

      {proposal.scope && (
        <div className="mb-6 p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-gray-500 text-xs uppercase mb-2">Scope</p>
          <p className="text-white text-sm whitespace-pre-wrap">{proposal.scope}</p>
        </div>
      )}

      {items.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm text-gray-400 uppercase mb-2">Line Items</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-left">
                <th className="p-2">Description</th>
                <th className="p-2">Qty</th>
                <th className="p-2">Rate</th>
                <th className="p-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-gray-800/50">
                  <td className="p-2 text-white">{item.description}</td>
                  <td className="p-2 text-gray-400">{item.quantity}</td>
                  <td className="p-2 text-gray-400">${item.unit_price}</td>
                  <td className="p-2 text-white text-right">${item.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {proposal.accepted_at && (
        <div className="mb-6 p-4 bg-green-900/20 border border-green-800 rounded-lg">
          <p className="text-green-400 text-sm">Accepted on {proposal.accepted_at.slice(0, 10)} from {proposal.accepted_ip}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {proposal.status === 'draft' && (
          <form action={markProposalSentAction}>
            <input type="hidden" name="id" value={proposal.id} />
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors">
              Mark as Sent
            </button>
          </form>
        )}
        {portalUrl && (
          <Link href={portalUrl} target="_blank" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors">
            View Public Link
          </Link>
        )}
        {proposal.status === 'sent' && (
          <form action={markProposalRejectedAction}>
            <input type="hidden" name="id" value={proposal.id} />
            <button type="submit" className="px-4 py-2 bg-red-900/50 hover:bg-red-900 text-red-400 text-sm rounded-lg transition-colors">
              Mark Rejected
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build to verify**

Run: `npm run build 2>&1 | grep -E "(error|proposals/\[)"`
Expected: `/proposals/[id]` route listed

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/proposals/\[id\]/page.tsx
git commit -m "feat(proposals): add proposal detail page"
```

---

### Task 7: Public Proposal View + Accept API

**Files:**
- Create: `src/app/proposals/view/[token]/page.tsx`
- Create: `src/app/api/proposals/[token]/accept/route.ts`

- [ ] **Step 1: Create public proposal view**

Create `src/app/proposals/view/[token]/page.tsx`:

```typescript
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getProposalByToken, getProposalItems } from '@/lib/queries/proposal-queries';
import { ProposalAcceptButton } from './accept-button';

export const dynamic = 'force-dynamic';

export default async function PublicProposalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = getDb();
  const proposal = getProposalByToken(db, token);
  if (!proposal) notFound();

  const items = getProposalItems(db, proposal.id);
  const isExpired = proposal.valid_until && new Date(proposal.valid_until) < new Date();
  const canAccept = proposal.status === 'sent' && !isExpired;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{proposal.title}</h1>
        <p className="text-gray-500 text-sm mb-8">
          {proposal.lead_name || proposal.client_name}
          {proposal.valid_until && ` · Valid until ${proposal.valid_until}`}
        </p>

        {proposal.scope && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Scope</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{proposal.scope}</p>
          </section>
        )}

        {proposal.timeline && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Timeline</h2>
            <p className="text-gray-700">{proposal.timeline}</p>
          </section>
        )}

        {items.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Pricing</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-2 font-medium">Description</th>
                  <th className="pb-2 font-medium">Qty</th>
                  <th className="pb-2 font-medium">Rate</th>
                  <th className="pb-2 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="py-2 text-gray-900">{item.description}</td>
                    <td className="py-2 text-gray-600">{item.quantity}</td>
                    <td className="py-2 text-gray-600">${item.unit_price}</td>
                    <td className="py-2 text-gray-900 text-right">${item.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-300">
                  <td colSpan={3} className="pt-3 text-right font-semibold text-gray-900">Total</td>
                  <td className="pt-3 text-right font-bold text-gray-900">${proposal.total_amount.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </section>
        )}

        {proposal.status === 'accepted' && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
            This proposal has been accepted.
          </div>
        )}

        {isExpired && proposal.status === 'sent' && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            This proposal has expired.
          </div>
        )}

        {canAccept && <ProposalAcceptButton token={token} />}

        <footer className="text-center text-gray-400 text-xs mt-12">Powered by CommandPost</footer>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create accept button client component**

Create `src/app/proposals/view/[token]/accept-button.tsx`:

```typescript
'use client';

import { useState } from 'react';

export function ProposalAcceptButton({ token }: { token: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  async function handleAccept() {
    if (!confirm('Accept this proposal? This will confirm the engagement.')) return;
    setStatus('loading');
    try {
      const res = await fetch(`/api/proposals/${token}/accept`, { method: 'POST' });
      if (res.ok) {
        setStatus('done');
        window.location.reload();
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  if (status === 'done') return <p className="text-green-600 font-medium mt-6">Proposal accepted! Thank you.</p>;
  if (status === 'error') return <p className="text-red-600 mt-6">Something went wrong. Please try again.</p>;

  return (
    <button
      onClick={handleAccept}
      disabled={status === 'loading'}
      className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
    >
      {status === 'loading' ? 'Processing...' : 'Accept Proposal'}
    </button>
  );
}
```

- [ ] **Step 3: Create accept API route**

Create `src/app/api/proposals/[token]/accept/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getProposalByToken, getProposalItems, updateProposalStatus } from '@/lib/queries/proposal-queries';
import { createContract } from '@/lib/queries/contract-queries';
import { createNotification } from '@/lib/notifications';
import { createClient } from '@/lib/queries/client-queries';
import { markLeadWon } from '@/lib/queries/lead-queries';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const db = getDb();

  const proposal = getProposalByToken(db, token);
  if (!proposal) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (proposal.status !== 'sent') {
    return NextResponse.json({ error: 'Proposal cannot be accepted' }, { status: 400 });
  }

  if (proposal.valid_until && new Date(proposal.valid_until) < new Date()) {
    return NextResponse.json({ error: 'Proposal has expired' }, { status: 400 });
  }

  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  // 1. Mark proposal accepted
  db.prepare("UPDATE proposals SET status = 'accepted', accepted_at = ?, accepted_ip = ?, updated_at = ? WHERE id = ?")
    .run(now, ip, now, proposal.id);

  // 2. Resolve client_id
  let clientId = proposal.client_id;

  if (!clientId && proposal.lead_id) {
    // Convert lead to client
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(proposal.lead_id) as any;
    if (lead && lead.stage !== 'won') {
      const newClientId = createClient(db, {
        name: lead.business_name,
        contact_person: lead.contact_person,
        email: lead.email,
        phone: lead.phone,
        source: lead.source,
        status: 'active',
        monthly_value: lead.estimated_value,
      });
      markLeadWon(db, proposal.lead_id, newClientId);
      clientId = newClientId;
      db.prepare('UPDATE proposals SET client_id = ? WHERE id = ?').run(clientId, proposal.id);
    }
  }

  if (!clientId) {
    return NextResponse.json({ error: 'No client could be resolved' }, { status: 400 });
  }

  // 3. Create project with deliverables from items
  const items = getProposalItems(db, proposal.id);
  const projectResult = db.prepare(
    "INSERT INTO projects (client_id, name, status) VALUES (?, ?, 'active')"
  ).run(clientId, proposal.title);
  const projectId = Number(projectResult.lastInsertRowid);

  for (const item of items) {
    db.prepare(
      "INSERT INTO deliverables (project_id, title, status) VALUES (?, ?, 'not_started')"
    ).run(projectId, item.description);
  }

  // 4. Create contract
  createContract(db, {
    client_id: clientId,
    proposal_id: proposal.id,
    title: proposal.title,
    terms_summary: proposal.scope || null,
    signed_at: now.slice(0, 10),
    expires_at: proposal.valid_until || null,
  });

  // 5. Notification
  await createNotification(db, {
    type: 'proposal_accepted',
    title: `Proposal accepted: ${proposal.title}`,
    message: proposal.lead_name || proposal.client_name || null,
    link: `/contracts`,
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Build to verify**

Run: `npm run build 2>&1 | grep -E "(error|proposals/view|/api/proposals)"`
Expected: routes listed, no errors

- [ ] **Step 5: Commit**

```bash
git add src/app/proposals/view/\[token\]/page.tsx src/app/proposals/view/\[token\]/accept-button.tsx src/app/api/proposals/\[token\]/accept/route.ts
git commit -m "feat(proposals): add public proposal view and acceptance API"
```

---

### Task 8: Contracts List Page

**Files:**
- Create: `src/app/(dashboard)/contracts/page.tsx`

- [ ] **Step 1: Create contracts page**

Create `src/app/(dashboard)/contracts/page.tsx`:

```typescript
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { listContracts } from '@/lib/queries/contract-queries';
import { StatusBadge } from '@/components/status-badge';

export const dynamic = 'force-dynamic';

export default function ContractsPage() {
  const db = getDb();
  const contracts = listContracts(db);

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86400000);

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-bold mb-6">Contracts</h1>

      {contracts.length === 0 ? (
        <p className="text-gray-500 text-sm">No contracts yet. Contracts are created when proposals are accepted.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-left">
                <th className="p-3">Title</th>
                <th className="p-3">Client</th>
                <th className="p-3">Signed</th>
                <th className="p-3">Expires</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => {
                const isExpiringSoon = c.expires_at && new Date(c.expires_at) <= thirtyDaysFromNow && c.status === 'active';
                return (
                  <tr key={c.id} className={`border-b border-gray-800/50 ${isExpiringSoon ? 'bg-yellow-900/10' : ''}`}>
                    <td className="p-3 text-white">{c.title}</td>
                    <td className="p-3">
                      <Link href={`/clients/${c.client_id}`} className="text-gray-400 hover:text-white">{c.client_name}</Link>
                    </td>
                    <td className="p-3 text-gray-400">{c.signed_at}</td>
                    <td className="p-3 text-gray-400">
                      {c.expires_at || '—'}
                      {isExpiringSoon && <span className="ml-2 text-yellow-400 text-xs">Expiring soon</span>}
                    </td>
                    <td className="p-3"><StatusBadge status={c.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/contracts/page.tsx
git commit -m "feat(proposals): add contracts list page"
```

---

### Task 9: Navigation + Cron Integration

**Files:**
- Modify: `src/components/sidebar.tsx`
- Modify: `src/components/mobile-nav.tsx`
- Modify: `src/app/api/cron/notifications/route.ts`
- Modify: `src/app/(dashboard)/settings/notifications/page.tsx`

- [ ] **Step 1: Add nav items**

In `src/components/sidebar.tsx`, add after the Pipeline entry:

```typescript
  { href: '/proposals', label: 'Proposals', icon: '▤' },
```

In `src/components/mobile-nav.tsx`, add after the Pipeline entry:

```typescript
  { href: '/proposals', label: 'Proposals', icon: '▤' },
```

- [ ] **Step 2: Add contract expiry cron check**

In `src/app/api/cron/notifications/route.ts`, add after the client health section (before the `return` statement):

```typescript
  // Contracts expiring soon
  const { getExpiringContracts } = await import('@/lib/queries/contract-queries');
  const expiringContracts = getExpiringContracts(db, 30);
  for (const contract of expiringContracts) {
    if (!hasAlertBeenSentInLastDays(db, 'contract_expiring', contract.id, 7)) {
      await createNotification(db, {
        type: 'contract_expiring',
        title: `Contract expiring: ${contract.title}`,
        message: `${contract.client_name} — expires ${contract.expires_at}`,
        link: `/contracts`,
      });
      created++;
    }
  }
```

- [ ] **Step 3: Add notification type labels**

In `src/app/(dashboard)/settings/notifications/page.tsx`, add to typeLabels:

```typescript
    proposal_accepted: 'Proposal Accepted',
    contract_expiring: 'Contract Expiring',
```

In `src/app/(dashboard)/notifications/page.tsx`, add to both typeLabels and typeColors:

```typescript
    proposal_accepted: 'Proposal Accepted',
    contract_expiring: 'Contract Expiring',
```

```typescript
    proposal_accepted: 'bg-green-900/30 text-green-400',
    contract_expiring: 'bg-yellow-900/30 text-yellow-400',
```

- [ ] **Step 4: Build and test**

Run: `npx vitest run && npm run build 2>&1 | grep error`
Expected: All tests PASS, no build errors

- [ ] **Step 5: Commit**

```bash
git add src/components/sidebar.tsx src/components/mobile-nav.tsx src/app/api/cron/notifications/route.ts src/app/\(dashboard\)/settings/notifications/page.tsx src/app/\(dashboard\)/notifications/page.tsx
git commit -m "feat(proposals): add nav items, cron contract expiry check, notification types"
```

---

### Task 10: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Run build**

Run: `npm run build 2>&1 | tail -20`
Expected: All routes listed including `/proposals`, `/proposals/[id]`, `/proposals/view/[token]`, `/contracts`, `/api/proposals/[token]/accept`

- [ ] **Step 3: Commit any remaining changes**

If clean, no action needed.
