# CommandPost Phase 3: Finances Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full Finances module with invoice CRUD (line items, status flow), expense tracking, revenue dashboard, per-client profitability, Stripe payment links (optional), PDF invoice export, recurring invoice cron, and dashboard integration.

**Architecture:** Three new database tables (invoices, invoice_items, expenses). Query layer + server actions following existing patterns. `/finances` page uses URL search params for tab navigation (invoices/expenses/revenue/profitability). Stripe gated on env var. PDF via `@react-pdf/renderer`. Recurring invoices via standalone cron script.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS, better-sqlite3, stripe (optional), @react-pdf/renderer

**IMPORTANT Next.js 16 notes:**
- File `src/proxy.ts` (not middleware.ts) handles auth — export `proxy()` not `middleware()`
- `params` and `searchParams` in page components are Promises — use `await params` / `await searchParams`
- Server actions used with `useActionState` must accept `(prevState, formData)` as args
- Server actions passed directly to `<form action={}>` take `(formData)` only

---

## File Structure

```
src/
├── lib/
│   ├── db.ts                                    # MODIFY: add invoices, invoice_items, expenses tables
│   ├── types.ts                                 # MODIFY: add Invoice, InvoiceItem, Expense interfaces
│   ├── stripe.ts                                # CREATE: Stripe client + isStripeConfigured()
│   ├── queries/
│   │   ├── invoice-queries.ts                   # CREATE: invoice + items CRUD, status transitions
│   │   ├── expense-queries.ts                   # CREATE: expense CRUD
│   │   ├── finance-queries.ts                   # CREATE: revenue, profitability, dashboard stats
│   │   └── dashboard-queries.ts                 # MODIFY: add overdue invoice action items + finance summary
│   └── actions/
│       ├── invoice-actions.ts                   # CREATE: invoice server actions
│       └── expense-actions.ts                   # CREATE: expense server actions
├── components/
│   ├── invoice-line-items.tsx                   # CREATE: dynamic line items editor (client component)
│   ├── expense-form.tsx                         # CREATE: expense form (client component)
│   ├── revenue-chart.tsx                        # CREATE: CSS bar chart (server component)
│   └── finance-tabs.tsx                         # CREATE: tab navigation (server component)
├── app/
│   ├── (dashboard)/
│   │   ├── finances/
│   │   │   ├── page.tsx                         # CREATE: main finances page with tabs
│   │   │   └── invoices/
│   │   │       ├── new/
│   │   │       │   └── page.tsx                 # CREATE: new invoice page
│   │   │       └── [id]/
│   │   │           ├── page.tsx                 # CREATE: invoice detail page
│   │   │           └── edit/
│   │   │               └── page.tsx             # CREATE: edit invoice page
│   │   └── page.tsx                             # MODIFY: add finance stats to dashboard
│   └── api/
│       └── invoices/
│           └── [id]/
│               └── pdf/
│                   └── route.ts                 # CREATE: PDF generation endpoint
scripts/
└── recurring-invoices.ts                        # CREATE: daily cron script
tests/
└── queries/
    ├── invoice-queries.test.ts                  # CREATE
    ├── expense-queries.test.ts                  # CREATE
    ├── finance-queries.test.ts                  # CREATE
    └── dashboard-queries.test.ts                # MODIFY: add invoice action item tests
```

---

### Task 1: Database Schema & Types

**Files:**
- Modify: `src/lib/db.ts`
- Modify: `src/lib/types.ts`
- Modify: `tests/lib/db.test.ts`

- [ ] **Step 1: Add Invoice, InvoiceItem, Expense interfaces to types.ts**

Add to the end of `src/lib/types.ts`:

```typescript
export interface Invoice {
  id: number;
  client_id: number;
  invoice_number: string;
  status: InvoiceStatus;
  due_date: string;
  sent_at: string | null;
  paid_at: string | null;
  stripe_payment_link: string | null;
  stripe_payment_id: string | null;
  is_recurring: number;
  recurrence_day: number | null;
  total_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: number;
  invoice_id: number;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export interface Expense {
  id: number;
  client_id: number | null;
  category: ExpenseCategory;
  description: string;
  amount: number;
  expense_date: string;
  created_at: string;
}
```

- [ ] **Step 2: Add finance tables to db.ts**

Add these CREATE TABLE statements to the `db.exec()` call in `initDb()`, after the `lead_notes` table:

```sql
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','paid')),
  due_date TEXT NOT NULL,
  sent_at TEXT,
  paid_at TEXT,
  stripe_payment_link TEXT,
  stripe_payment_id TEXT,
  is_recurring INTEGER NOT NULL DEFAULT 0,
  recurrence_day INTEGER,
  total_amount REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL,
  amount REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'other' CHECK(category IN ('servers','software','contractor','marketing','other')),
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  expense_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- [ ] **Step 3: Update db test to verify new tables**

Add to the `'creates all required tables'` test in `tests/lib/db.test.ts`:

```typescript
expect(tables).toContain('invoices');
expect(tables).toContain('invoice_items');
expect(tables).toContain('expenses');
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/philipsmith/commandpost && npx vitest run tests/lib/db.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/philipsmith/commandpost
git add src/lib/db.ts src/lib/types.ts tests/lib/db.test.ts
git commit -m "feat: add finance database tables and types (invoices, items, expenses)"
```

---

### Task 2: Invoice Queries

**Files:**
- Create: `src/lib/queries/invoice-queries.ts`
- Create: `tests/queries/invoice-queries.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/queries/invoice-queries.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initDb } from '@/lib/db';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-invoices.db');

describe('invoice queries', () => {
  let db: Database.Database;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    db = initDb(TEST_DB_PATH);
    // Insert a test client
    db.prepare("INSERT INTO clients (name, status) VALUES (?, ?)").run('Test Client', 'active');
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('creates an invoice with auto-generated number and items', async () => {
    const { createInvoice, getInvoiceById } = await import('@/lib/queries/invoice-queries');
    const id = createInvoice(db, {
      client_id: 1,
      due_date: '2026-06-01',
      items: [
        { description: 'Web Design', quantity: 1, unit_price: 3000 },
        { description: 'Hosting Setup', quantity: 2, unit_price: 500 },
      ],
    });
    expect(id).toBeGreaterThan(0);
    const invoice = getInvoiceById(db, id);
    expect(invoice!.invoice_number).toBe('INV-0001');
    expect(invoice!.status).toBe('draft');
    expect(invoice!.total_amount).toBe(4000);
    expect(invoice!.items).toHaveLength(2);
    expect(invoice!.items[0].amount).toBe(3000);
    expect(invoice!.items[1].amount).toBe(1000);
  });

  it('auto-increments invoice numbers', async () => {
    const { createInvoice, getInvoiceById } = await import('@/lib/queries/invoice-queries');
    const id1 = createInvoice(db, { client_id: 1, due_date: '2026-06-01', items: [{ description: 'A', quantity: 1, unit_price: 100 }] });
    const id2 = createInvoice(db, { client_id: 1, due_date: '2026-07-01', items: [{ description: 'B', quantity: 1, unit_price: 200 }] });
    expect(getInvoiceById(db, id1)!.invoice_number).toBe('INV-0001');
    expect(getInvoiceById(db, id2)!.invoice_number).toBe('INV-0002');
  });

  it('marks invoice as sent', async () => {
    const { createInvoice, markInvoiceSent, getInvoiceById } = await import('@/lib/queries/invoice-queries');
    const id = createInvoice(db, { client_id: 1, due_date: '2026-06-01', items: [{ description: 'A', quantity: 1, unit_price: 100 }] });
    markInvoiceSent(db, id);
    const invoice = getInvoiceById(db, id);
    expect(invoice!.status).toBe('sent');
    expect(invoice!.sent_at).toBeTruthy();
  });

  it('marks invoice as paid', async () => {
    const { createInvoice, markInvoiceSent, markInvoicePaid, getInvoiceById } = await import('@/lib/queries/invoice-queries');
    const id = createInvoice(db, { client_id: 1, due_date: '2026-06-01', items: [{ description: 'A', quantity: 1, unit_price: 100 }] });
    markInvoiceSent(db, id);
    markInvoicePaid(db, id);
    const invoice = getInvoiceById(db, id);
    expect(invoice!.status).toBe('paid');
    expect(invoice!.paid_at).toBeTruthy();
  });

  it('lists invoices with client name and overdue detection', async () => {
    const { createInvoice, markInvoiceSent, listInvoices } = await import('@/lib/queries/invoice-queries');
    const id1 = createInvoice(db, { client_id: 1, due_date: '2025-01-01', items: [{ description: 'A', quantity: 1, unit_price: 100 }] });
    markInvoiceSent(db, id1);
    createInvoice(db, { client_id: 1, due_date: '2099-12-31', items: [{ description: 'B', quantity: 1, unit_price: 200 }] });
    const all = listInvoices(db);
    expect(all).toHaveLength(2);
    const overdue = listInvoices(db, 'overdue');
    expect(overdue).toHaveLength(1);
    expect(overdue[0].client_name).toBe('Test Client');
  });

  it('updates invoice and recalculates total', async () => {
    const { createInvoice, updateInvoice, getInvoiceById } = await import('@/lib/queries/invoice-queries');
    const id = createInvoice(db, { client_id: 1, due_date: '2026-06-01', items: [{ description: 'A', quantity: 1, unit_price: 100 }] });
    updateInvoice(db, id, {
      due_date: '2026-07-01',
      notes: 'Updated',
      items: [
        { description: 'New item', quantity: 3, unit_price: 500 },
      ],
    });
    const invoice = getInvoiceById(db, id);
    expect(invoice!.due_date).toBe('2026-07-01');
    expect(invoice!.notes).toBe('Updated');
    expect(invoice!.total_amount).toBe(1500);
    expect(invoice!.items).toHaveLength(1);
  });

  it('gets invoice summary stats', async () => {
    const { createInvoice, markInvoiceSent, markInvoicePaid, getInvoiceSummary } = await import('@/lib/queries/invoice-queries');
    const id1 = createInvoice(db, { client_id: 1, due_date: '2025-01-01', items: [{ description: 'A', quantity: 1, unit_price: 1000 }] });
    markInvoiceSent(db, id1);
    const id2 = createInvoice(db, { client_id: 1, due_date: '2099-12-31', items: [{ description: 'B', quantity: 1, unit_price: 2000 }] });
    markInvoiceSent(db, id2);
    const id3 = createInvoice(db, { client_id: 1, due_date: '2026-05-01', items: [{ description: 'C', quantity: 1, unit_price: 500 }] });
    markInvoiceSent(db, id3);
    markInvoicePaid(db, id3);
    const summary = getInvoiceSummary(db);
    expect(summary.totalOutstanding).toBe(3000);
    expect(summary.totalOverdue).toBe(1000);
    expect(summary.overdueCount).toBe(1);
  });

  it('deletes an invoice', async () => {
    const { createInvoice, deleteInvoice, getInvoiceById } = await import('@/lib/queries/invoice-queries');
    const id = createInvoice(db, { client_id: 1, due_date: '2026-06-01', items: [{ description: 'A', quantity: 1, unit_price: 100 }] });
    deleteInvoice(db, id);
    expect(getInvoiceById(db, id)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/philipsmith/commandpost && npx vitest run tests/queries/invoice-queries.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement invoice queries**

Create `src/lib/queries/invoice-queries.ts`:

```typescript
import type Database from 'better-sqlite3';
import type { Invoice, InvoiceItem, InvoiceStatus } from '@/lib/types';

interface CreateInvoiceInput {
  client_id: number;
  due_date: string;
  notes?: string | null;
  is_recurring?: boolean;
  recurrence_day?: number | null;
  items: { description: string; quantity: number; unit_price: number }[];
}

interface UpdateInvoiceInput {
  due_date?: string;
  notes?: string | null;
  is_recurring?: boolean;
  recurrence_day?: number | null;
  items?: { description: string; quantity: number; unit_price: number }[];
}

export interface InvoiceWithClient extends Invoice {
  client_name: string;
  items: InvoiceItem[];
  is_overdue: boolean;
}

export interface InvoiceSummary {
  totalOutstanding: number;
  totalOverdue: number;
  overdueCount: number;
  paidThisMonth: number;
}

function generateInvoiceNumber(db: Database.Database): string {
  const last = db.prepare("SELECT invoice_number FROM invoices ORDER BY id DESC LIMIT 1").get() as { invoice_number: string } | undefined;
  if (!last) return 'INV-0001';
  const num = parseInt(last.invoice_number.replace('INV-', ''), 10);
  return `INV-${String(num + 1).padStart(4, '0')}`;
}

function recalcTotal(db: Database.Database, invoiceId: number): void {
  const total = (db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM invoice_items WHERE invoice_id = ?").get(invoiceId) as any).total;
  db.prepare("UPDATE invoices SET total_amount = ?, updated_at = datetime('now') WHERE id = ?").run(total, invoiceId);
}

export function createInvoice(db: Database.Database, input: CreateInvoiceInput): number {
  const invoiceNumber = generateInvoiceNumber(db);

  const result = db.prepare(`
    INSERT INTO invoices (client_id, invoice_number, due_date, notes, is_recurring, recurrence_day)
    VALUES (@client_id, @invoice_number, @due_date, @notes, @is_recurring, @recurrence_day)
  `).run({
    client_id: input.client_id,
    invoice_number: invoiceNumber,
    due_date: input.due_date,
    notes: input.notes ?? null,
    is_recurring: input.is_recurring ? 1 : 0,
    recurrence_day: input.recurrence_day ?? null,
  });

  const invoiceId = Number(result.lastInsertRowid);

  const insertItem = db.prepare(
    'INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (?, ?, ?, ?, ?)'
  );
  for (const item of input.items) {
    insertItem.run(invoiceId, item.description, item.quantity, item.unit_price, item.quantity * item.unit_price);
  }

  recalcTotal(db, invoiceId);
  return invoiceId;
}

export function getInvoiceById(db: Database.Database, id: number): InvoiceWithClient | undefined {
  const invoice = db.prepare(`
    SELECT i.*, c.name as client_name
    FROM invoices i JOIN clients c ON i.client_id = c.id
    WHERE i.id = ?
  `).get(id) as (Invoice & { client_name: string }) | undefined;

  if (!invoice) return undefined;

  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id').all(id) as InvoiceItem[];
  const isOverdue = invoice.status === 'sent' && invoice.due_date < new Date().toISOString().split('T')[0];

  return { ...invoice, items, is_overdue: isOverdue };
}

export function listInvoices(db: Database.Database, statusFilter?: string): InvoiceWithClient[] {
  let sql = `
    SELECT i.*, c.name as client_name
    FROM invoices i JOIN clients c ON i.client_id = c.id
  `;
  const params: any[] = [];

  if (statusFilter === 'overdue') {
    sql += " WHERE i.status = 'sent' AND i.due_date < date('now')";
  } else if (statusFilter && statusFilter !== 'all') {
    sql += ' WHERE i.status = ?';
    params.push(statusFilter);
  }

  sql += ' ORDER BY i.created_at DESC';

  const invoices = db.prepare(sql).all(...params) as (Invoice & { client_name: string })[];

  return invoices.map((inv) => {
    const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id').all(inv.id) as InvoiceItem[];
    const isOverdue = inv.status === 'sent' && inv.due_date < new Date().toISOString().split('T')[0];
    return { ...inv, items, is_overdue: isOverdue };
  });
}

export function updateInvoice(db: Database.Database, id: number, input: UpdateInvoiceInput): void {
  if (input.due_date !== undefined || input.notes !== undefined || input.is_recurring !== undefined || input.recurrence_day !== undefined) {
    const fields: string[] = [];
    const params: any = { id };

    if (input.due_date !== undefined) { fields.push('due_date = @due_date'); params.due_date = input.due_date; }
    if (input.notes !== undefined) { fields.push('notes = @notes'); params.notes = input.notes; }
    if (input.is_recurring !== undefined) { fields.push('is_recurring = @is_recurring'); params.is_recurring = input.is_recurring ? 1 : 0; }
    if (input.recurrence_day !== undefined) { fields.push('recurrence_day = @recurrence_day'); params.recurrence_day = input.recurrence_day; }

    fields.push("updated_at = datetime('now')");
    db.prepare(`UPDATE invoices SET ${fields.join(', ')} WHERE id = @id`).run(params);
  }

  if (input.items) {
    db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(id);
    const insertItem = db.prepare(
      'INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (?, ?, ?, ?, ?)'
    );
    for (const item of input.items) {
      insertItem.run(id, item.description, item.quantity, item.unit_price, item.quantity * item.unit_price);
    }
    recalcTotal(db, id);
  }
}

export function markInvoiceSent(db: Database.Database, id: number): void {
  db.prepare("UPDATE invoices SET status = 'sent', sent_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(id);
}

export function markInvoicePaid(db: Database.Database, id: number): void {
  db.prepare("UPDATE invoices SET status = 'paid', paid_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(id);
}

export function deleteInvoice(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM invoices WHERE id = ?').run(id);
}

export function getInvoiceSummary(db: Database.Database): InvoiceSummary {
  const totalOutstanding = (db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'sent'").get() as any).total;
  const totalOverdue = (db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'sent' AND due_date < date('now')").get() as any).total;
  const overdueCount = (db.prepare("SELECT COUNT(*) as count FROM invoices WHERE status = 'sent' AND due_date < date('now')").get() as any).count;
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const paidThisMonth = (db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'paid' AND paid_at >= ?").get(monthStart) as any).total;
  return { totalOutstanding, totalOverdue, overdueCount, paidThisMonth };
}

export function getRecurringInvoicesDue(db: Database.Database): Invoice[] {
  return db.prepare("SELECT * FROM invoices WHERE is_recurring = 1 AND status IN ('sent','paid')").all() as Invoice[];
}

export function setStripePaymentLink(db: Database.Database, id: number, link: string): void {
  db.prepare("UPDATE invoices SET stripe_payment_link = ?, updated_at = datetime('now') WHERE id = ?").run(link, id);
}

export function setStripePaymentId(db: Database.Database, id: number, paymentId: string): void {
  db.prepare("UPDATE invoices SET stripe_payment_id = ?, status = 'paid', paid_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(paymentId, id);
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/philipsmith/commandpost && npx vitest run tests/queries/invoice-queries.test.ts
```

Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/philipsmith/commandpost
git add src/lib/queries/invoice-queries.ts tests/queries/invoice-queries.test.ts
git commit -m "feat: add invoice CRUD queries with items, status flow, and summary"
```

---

### Task 3: Expense Queries

**Files:**
- Create: `src/lib/queries/expense-queries.ts`
- Create: `tests/queries/expense-queries.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/queries/expense-queries.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initDb } from '@/lib/db';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-expenses.db');

describe('expense queries', () => {
  let db: Database.Database;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    db = initDb(TEST_DB_PATH);
    db.prepare("INSERT INTO clients (name, status) VALUES (?, ?)").run('Test Client', 'active');
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('creates and retrieves an expense', async () => {
    const { createExpense, getExpenseById } = await import('@/lib/queries/expense-queries');
    const id = createExpense(db, {
      category: 'servers',
      description: 'DigitalOcean droplet',
      amount: 24,
      expense_date: '2026-05-01',
      client_id: 1,
    });
    expect(id).toBeGreaterThan(0);
    const expense = getExpenseById(db, id);
    expect(expense!.description).toBe('DigitalOcean droplet');
    expect(expense!.client_name).toBe('Test Client');
  });

  it('lists expenses with optional filters', async () => {
    const { createExpense, listExpenses } = await import('@/lib/queries/expense-queries');
    createExpense(db, { category: 'servers', description: 'A', amount: 10, expense_date: '2026-05-01' });
    createExpense(db, { category: 'software', description: 'B', amount: 20, expense_date: '2026-05-15' });
    createExpense(db, { category: 'servers', description: 'C', amount: 30, expense_date: '2026-04-01' });

    const all = listExpenses(db);
    expect(all).toHaveLength(3);

    const serversOnly = listExpenses(db, { category: 'servers' });
    expect(serversOnly).toHaveLength(2);

    const mayOnly = listExpenses(db, { month: '2026-05' });
    expect(mayOnly).toHaveLength(2);
  });

  it('updates an expense', async () => {
    const { createExpense, updateExpense, getExpenseById } = await import('@/lib/queries/expense-queries');
    const id = createExpense(db, { category: 'servers', description: 'Old', amount: 10, expense_date: '2026-05-01' });
    updateExpense(db, id, { description: 'New', amount: 20 });
    const expense = getExpenseById(db, id);
    expect(expense!.description).toBe('New');
    expect(expense!.amount).toBe(20);
  });

  it('deletes an expense', async () => {
    const { createExpense, deleteExpense, getExpenseById } = await import('@/lib/queries/expense-queries');
    const id = createExpense(db, { category: 'other', description: 'X', amount: 5, expense_date: '2026-05-01' });
    deleteExpense(db, id);
    expect(getExpenseById(db, id)).toBeUndefined();
  });

  it('gets monthly total', async () => {
    const { createExpense, getExpenseMonthlyTotal } = await import('@/lib/queries/expense-queries');
    createExpense(db, { category: 'servers', description: 'A', amount: 10, expense_date: '2026-05-01' });
    createExpense(db, { category: 'software', description: 'B', amount: 20, expense_date: '2026-05-15' });
    const total = getExpenseMonthlyTotal(db, '2026-05');
    expect(total).toBe(30);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/philipsmith/commandpost && npx vitest run tests/queries/expense-queries.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement expense queries**

Create `src/lib/queries/expense-queries.ts`:

```typescript
import type Database from 'better-sqlite3';
import type { Expense, ExpenseCategory } from '@/lib/types';

interface CreateExpenseInput {
  client_id?: number | null;
  category: ExpenseCategory;
  description: string;
  amount: number;
  expense_date: string;
}

interface UpdateExpenseInput {
  client_id?: number | null;
  category?: ExpenseCategory;
  description?: string;
  amount?: number;
  expense_date?: string;
}

interface ListExpensesFilter {
  category?: ExpenseCategory;
  month?: string; // 'YYYY-MM'
}

export interface ExpenseWithClient extends Expense {
  client_name: string | null;
}

export function createExpense(db: Database.Database, input: CreateExpenseInput): number {
  const result = db.prepare(`
    INSERT INTO expenses (client_id, category, description, amount, expense_date)
    VALUES (@client_id, @category, @description, @amount, @expense_date)
  `).run({
    client_id: input.client_id ?? null,
    category: input.category,
    description: input.description,
    amount: input.amount,
    expense_date: input.expense_date,
  });
  return Number(result.lastInsertRowid);
}

export function getExpenseById(db: Database.Database, id: number): ExpenseWithClient | undefined {
  return db.prepare(`
    SELECT e.*, c.name as client_name
    FROM expenses e LEFT JOIN clients c ON e.client_id = c.id
    WHERE e.id = ?
  `).get(id) as ExpenseWithClient | undefined;
}

export function listExpenses(db: Database.Database, filter?: ListExpensesFilter): ExpenseWithClient[] {
  let sql = 'SELECT e.*, c.name as client_name FROM expenses e LEFT JOIN clients c ON e.client_id = c.id';
  const conditions: string[] = [];
  const params: any[] = [];

  if (filter?.category) {
    conditions.push('e.category = ?');
    params.push(filter.category);
  }
  if (filter?.month) {
    conditions.push("strftime('%Y-%m', e.expense_date) = ?");
    params.push(filter.month);
  }

  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY e.expense_date DESC';

  return db.prepare(sql).all(...params) as ExpenseWithClient[];
}

export function updateExpense(db: Database.Database, id: number, input: UpdateExpenseInput): void {
  const fields: string[] = [];
  const params: any = { id };

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      fields.push(`${key} = @${key}`);
      params[key] = value;
    }
  }

  if (fields.length === 0) return;
  db.prepare(`UPDATE expenses SET ${fields.join(', ')} WHERE id = @id`).run(params);
}

export function deleteExpense(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
}

export function getExpenseMonthlyTotal(db: Database.Database, month: string): number {
  return (db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE strftime('%Y-%m', expense_date) = ?").get(month) as any).total;
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/philipsmith/commandpost && npx vitest run tests/queries/expense-queries.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/philipsmith/commandpost
git add src/lib/queries/expense-queries.ts tests/queries/expense-queries.test.ts
git commit -m "feat: add expense CRUD queries with filtering and monthly totals"
```

---

### Task 4: Finance Aggregate Queries (Revenue, Profitability)

**Files:**
- Create: `src/lib/queries/finance-queries.ts`
- Create: `tests/queries/finance-queries.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/queries/finance-queries.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initDb } from '@/lib/db';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-finance.db');

describe('finance queries', () => {
  let db: Database.Database;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    db = initDb(TEST_DB_PATH);
    db.prepare("INSERT INTO clients (name, status) VALUES (?, ?)").run('Client A', 'active');
    db.prepare("INSERT INTO clients (name, status) VALUES (?, ?)").run('Client B', 'active');
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('gets monthly revenue for last 12 months', async () => {
    const { getMonthlyRevenue } = await import('@/lib/queries/finance-queries');
    // Insert a paid invoice
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, paid_at, total_amount) VALUES (?, ?, ?, ?, ?, ?)").run(1, 'INV-0001', 'paid', '2026-05-01', '2026-05-02', 3000);
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, paid_at, total_amount) VALUES (?, ?, ?, ?, ?, ?)").run(1, 'INV-0002', 'paid', '2026-05-15', '2026-05-16', 2000);
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, paid_at, total_amount) VALUES (?, ?, ?, ?, ?, ?)").run(2, 'INV-0003', 'paid', '2026-04-01', '2026-04-05', 1000);

    const revenue = getMonthlyRevenue(db);
    expect(revenue.length).toBe(12);
    const may = revenue.find(r => r.month === '2026-05');
    expect(may?.amount).toBe(5000);
    const apr = revenue.find(r => r.month === '2026-04');
    expect(apr?.amount).toBe(1000);
  });

  it('gets profitability per client', async () => {
    const { getProfitabilityByClient } = await import('@/lib/queries/finance-queries');
    // Client A: $3000 revenue, $500 expenses
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, paid_at, total_amount) VALUES (?, ?, ?, ?, ?, ?)").run(1, 'INV-0001', 'paid', '2026-05-01', '2026-05-02', 3000);
    db.prepare("INSERT INTO expenses (client_id, category, description, amount, expense_date) VALUES (?, ?, ?, ?, ?)").run(1, 'servers', 'Hosting', 500, '2026-05-01');
    // Client B: $1000 revenue, $200 expenses
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, paid_at, total_amount) VALUES (?, ?, ?, ?, ?, ?)").run(2, 'INV-0002', 'paid', '2026-05-01', '2026-05-03', 1000);
    db.prepare("INSERT INTO expenses (client_id, category, description, amount, expense_date) VALUES (?, ?, ?, ?, ?)").run(2, 'software', 'License', 200, '2026-05-01');

    const profit = getProfitabilityByClient(db);
    expect(profit).toHaveLength(2);
    expect(profit[0].client_name).toBe('Client A');
    expect(profit[0].revenue).toBe(3000);
    expect(profit[0].expenses).toBe(500);
    expect(profit[0].profit).toBe(2500);
  });

  it('gets YTD stats', async () => {
    const { getYtdStats } = await import('@/lib/queries/finance-queries');
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, paid_at, total_amount) VALUES (?, ?, ?, ?, ?, ?)").run(1, 'INV-0001', 'paid', '2026-05-01', '2026-05-02', 5000);
    db.prepare("INSERT INTO expenses (client_id, category, description, amount, expense_date) VALUES (?, ?, ?, ?, ?)").run(null, 'other', 'Office', 1000, '2026-03-01');
    const stats = getYtdStats(db);
    expect(stats.revenue).toBe(5000);
    expect(stats.expenses).toBe(1000);
    expect(stats.profit).toBe(4000);
  });

  it('gets revenue by client top 5', async () => {
    const { getRevenueByClient } = await import('@/lib/queries/finance-queries');
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, paid_at, total_amount) VALUES (?, ?, ?, ?, ?, ?)").run(1, 'INV-0001', 'paid', '2026-05-01', '2026-05-02', 5000);
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, paid_at, total_amount) VALUES (?, ?, ?, ?, ?, ?)").run(2, 'INV-0002', 'paid', '2026-05-01', '2026-05-03', 2000);
    const top = getRevenueByClient(db);
    expect(top).toHaveLength(2);
    expect(top[0].client_name).toBe('Client A');
    expect(top[0].total).toBe(5000);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/philipsmith/commandpost && npx vitest run tests/queries/finance-queries.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement finance queries**

Create `src/lib/queries/finance-queries.ts`:

```typescript
import type Database from 'better-sqlite3';

export interface MonthlyRevenue {
  month: string; // 'YYYY-MM'
  amount: number;
}

export interface ClientProfitability {
  client_id: number;
  client_name: string;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number | null;
}

export interface YtdStats {
  revenue: number;
  expenses: number;
  profit: number;
}

export interface ClientRevenue {
  client_id: number;
  client_name: string;
  total: number;
}

export function getMonthlyRevenue(db: Database.Database): MonthlyRevenue[] {
  const months: MonthlyRevenue[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const amount = (db.prepare(
      "SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'paid' AND strftime('%Y-%m', paid_at) = ?"
    ).get(month) as any).total;
    months.push({ month, amount });
  }
  return months;
}

export function getProfitabilityByClient(db: Database.Database, period?: string): ClientProfitability[] {
  let revenueWhere = "i.status = 'paid'";
  let expenseWhere = '1=1';
  const year = new Date().getFullYear();

  if (period === 'this_month') {
    const m = `${year}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    revenueWhere += ` AND strftime('%Y-%m', i.paid_at) = '${m}'`;
    expenseWhere += ` AND strftime('%Y-%m', e.expense_date) = '${m}'`;
  } else if (period === 'last_3_months') {
    const d = new Date(); d.setMonth(d.getMonth() - 3);
    const cutoff = d.toISOString().split('T')[0];
    revenueWhere += ` AND i.paid_at >= '${cutoff}'`;
    expenseWhere += ` AND e.expense_date >= '${cutoff}'`;
  } else if (period === 'ytd') {
    revenueWhere += ` AND strftime('%Y', i.paid_at) = '${year}'`;
    expenseWhere += ` AND strftime('%Y', e.expense_date) = '${year}'`;
  }
  // 'all' or undefined = no time filter

  const rows = db.prepare(`
    SELECT c.id as client_id, c.name as client_name,
      COALESCE((SELECT SUM(i.total_amount) FROM invoices i WHERE i.client_id = c.id AND ${revenueWhere}), 0) as revenue,
      COALESCE((SELECT SUM(e.amount) FROM expenses e WHERE e.client_id = c.id AND ${expenseWhere}), 0) as expenses
    FROM clients c
    WHERE c.deleted_at IS NULL
    HAVING revenue > 0 OR expenses > 0
    ORDER BY (revenue - expenses) DESC
  `).all() as any[];

  return rows.map((r: any) => ({
    client_id: r.client_id,
    client_name: r.client_name,
    revenue: r.revenue,
    expenses: r.expenses,
    profit: r.revenue - r.expenses,
    margin: r.revenue > 0 ? Math.round(((r.revenue - r.expenses) / r.revenue) * 100) : null,
  }));
}

export function getYtdStats(db: Database.Database): YtdStats {
  const year = String(new Date().getFullYear());
  const revenue = (db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'paid' AND strftime('%Y', paid_at) = ?").get(year) as any).total;
  const expenses = (db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE strftime('%Y', expense_date) = ?").get(year) as any).total;
  return { revenue, expenses, profit: revenue - expenses };
}

export function getRevenueByClient(db: Database.Database, limit: number = 5): ClientRevenue[] {
  return db.prepare(`
    SELECT c.id as client_id, c.name as client_name, COALESCE(SUM(i.total_amount), 0) as total
    FROM invoices i JOIN clients c ON i.client_id = c.id
    WHERE i.status = 'paid' AND c.deleted_at IS NULL
    GROUP BY c.id
    ORDER BY total DESC
    LIMIT ?
  `).all(limit) as ClientRevenue[];
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/philipsmith/commandpost && npx vitest run tests/queries/finance-queries.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/philipsmith/commandpost
git add src/lib/queries/finance-queries.ts tests/queries/finance-queries.test.ts
git commit -m "feat: add finance aggregate queries (revenue, profitability, YTD stats)"
```

---

### Task 5: Server Actions (Invoices & Expenses)

**Files:**
- Create: `src/lib/actions/invoice-actions.ts`
- Create: `src/lib/actions/expense-actions.ts`
- Create: `src/lib/stripe.ts`

- [ ] **Step 1: Create Stripe utility**

Create `src/lib/stripe.ts`:

```typescript
export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export async function createStripePaymentLink(amount: number, invoiceNumber: string): Promise<string> {
  if (!isStripeConfigured()) throw new Error('Stripe not configured');
  const stripe = (await import('stripe')).default;
  const client = new stripe(process.env.STRIPE_SECRET_KEY!);

  const session = await client.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: `Invoice ${invoiceNumber}` },
        unit_amount: Math.round(amount * 100),
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3004'}/finances?payment=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3004'}/finances?payment=cancelled`,
  });

  return session.url!;
}

export async function checkStripePayment(sessionUrl: string): Promise<{ paid: boolean; paymentId?: string }> {
  if (!isStripeConfigured()) throw new Error('Stripe not configured');
  const stripe = (await import('stripe')).default;
  const client = new stripe(process.env.STRIPE_SECRET_KEY!);

  // Extract session ID from URL
  const url = new URL(sessionUrl);
  const sessionId = url.pathname.split('/').pop();
  if (!sessionId) return { paid: false };

  const session = await client.checkout.sessions.retrieve(sessionId);
  return {
    paid: session.payment_status === 'paid',
    paymentId: session.payment_intent as string | undefined,
  };
}
```

- [ ] **Step 2: Create invoice server actions**

Create `src/lib/actions/invoice-actions.ts`:

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import {
  createInvoice,
  updateInvoice,
  markInvoiceSent,
  markInvoicePaid,
  deleteInvoice,
  getInvoiceById,
  setStripePaymentLink,
  setStripePaymentId,
} from '@/lib/queries/invoice-queries';
import { isStripeConfigured, createStripePaymentLink, checkStripePayment } from '@/lib/stripe';

export async function createInvoiceAction(formData: FormData) {
  const db = getDb();
  const descriptions = formData.getAll('item_description') as string[];
  const quantities = formData.getAll('item_quantity') as string[];
  const unitPrices = formData.getAll('item_unit_price') as string[];

  const items = descriptions.map((desc, i) => ({
    description: desc,
    quantity: Number(quantities[i]) || 1,
    unit_price: Number(unitPrices[i]) || 0,
  })).filter(item => item.description && item.unit_price > 0);

  const id = createInvoice(db, {
    client_id: Number(formData.get('client_id')),
    due_date: formData.get('due_date') as string,
    notes: (formData.get('notes') as string) || null,
    is_recurring: formData.get('is_recurring') === 'on',
    recurrence_day: formData.get('recurrence_day') ? Number(formData.get('recurrence_day')) : null,
    items,
  });

  revalidatePath('/finances');
  redirect(`/finances/invoices/${id}`);
}

export async function updateInvoiceAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  const descriptions = formData.getAll('item_description') as string[];
  const quantities = formData.getAll('item_quantity') as string[];
  const unitPrices = formData.getAll('item_unit_price') as string[];

  const items = descriptions.map((desc, i) => ({
    description: desc,
    quantity: Number(quantities[i]) || 1,
    unit_price: Number(unitPrices[i]) || 0,
  })).filter(item => item.description && item.unit_price > 0);

  updateInvoice(db, id, {
    due_date: formData.get('due_date') as string,
    notes: (formData.get('notes') as string) || null,
    is_recurring: formData.get('is_recurring') === 'on',
    recurrence_day: formData.get('recurrence_day') ? Number(formData.get('recurrence_day')) : null,
    items,
  });

  revalidatePath('/finances');
  revalidatePath(`/finances/invoices/${id}`);
  redirect(`/finances/invoices/${id}`);
}

export async function markInvoiceSentAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  markInvoiceSent(db, id);
  revalidatePath('/finances');
  revalidatePath(`/finances/invoices/${id}`);
  redirect(`/finances/invoices/${id}`);
}

export async function markInvoicePaidAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  markInvoicePaid(db, id);
  revalidatePath('/finances');
  revalidatePath(`/finances/invoices/${id}`);
  redirect(`/finances/invoices/${id}`);
}

export async function generateStripeLink(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  const invoice = getInvoiceById(db, id);
  if (!invoice || !isStripeConfigured()) return;

  const link = await createStripePaymentLink(invoice.total_amount, invoice.invoice_number);
  setStripePaymentLink(db, id, link);

  revalidatePath(`/finances/invoices/${id}`);
  redirect(`/finances/invoices/${id}`);
}

export async function syncStripePaymentAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  const invoice = getInvoiceById(db, id);
  if (!invoice?.stripe_payment_link || !isStripeConfigured()) return;

  const result = await checkStripePayment(invoice.stripe_payment_link);
  if (result.paid && result.paymentId) {
    setStripePaymentId(db, id, result.paymentId);
  }

  revalidatePath('/finances');
  revalidatePath(`/finances/invoices/${id}`);
  redirect(`/finances/invoices/${id}`);
}

export async function deleteInvoiceAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  deleteInvoice(db, id);
  revalidatePath('/finances');
  redirect('/finances');
}
```

- [ ] **Step 3: Create expense server actions**

Create `src/lib/actions/expense-actions.ts`:

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import {
  createExpense,
  updateExpense,
  deleteExpense,
} from '@/lib/queries/expense-queries';
import type { ExpenseCategory } from '@/lib/types';

export async function createExpenseAction(formData: FormData) {
  const db = getDb();
  createExpense(db, {
    client_id: formData.get('client_id') ? Number(formData.get('client_id')) : null,
    category: (formData.get('category') as ExpenseCategory) || 'other',
    description: formData.get('description') as string,
    amount: Number(formData.get('amount')),
    expense_date: formData.get('expense_date') as string,
  });

  revalidatePath('/finances');
}

export async function updateExpenseAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));

  updateExpense(db, id, {
    client_id: formData.get('client_id') ? Number(formData.get('client_id')) : null,
    category: (formData.get('category') as ExpenseCategory) || 'other',
    description: formData.get('description') as string,
    amount: Number(formData.get('amount')),
    expense_date: formData.get('expense_date') as string,
  });

  revalidatePath('/finances');
}

export async function deleteExpenseAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  deleteExpense(db, id);
  revalidatePath('/finances');
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/philipsmith/commandpost
git add src/lib/stripe.ts src/lib/actions/invoice-actions.ts src/lib/actions/expense-actions.ts
git commit -m "feat: add invoice and expense server actions with Stripe integration"
```

---

### Task 6: Finance UI Components

**Files:**
- Create: `src/components/invoice-line-items.tsx`
- Create: `src/components/expense-form.tsx`
- Create: `src/components/revenue-chart.tsx`
- Create: `src/components/finance-tabs.tsx`

- [ ] **Step 1: Create dynamic line items editor**

Create `src/components/invoice-line-items.tsx`:

```tsx
'use client';

import { useState } from 'react';

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
}

interface InvoiceLineItemsProps {
  initialItems?: LineItem[];
}

export function InvoiceLineItems({ initialItems }: InvoiceLineItemsProps) {
  const [items, setItems] = useState<LineItem[]>(
    initialItems?.length ? initialItems : [{ description: '', quantity: 1, unit_price: 0 }]
  );

  function addItem() {
    setItems([...items, { description: '', quantity: 1, unit_price: 0 }]);
  }

  function removeItem(index: number) {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof LineItem, value: string | number) {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  }

  const total = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  return (
    <div>
      <label className="block text-sm text-gray-400 mb-2">Line Items</label>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2 items-start">
            <input type="text" name="item_description" value={item.description} required
              onChange={(e) => updateItem(i, 'description', e.target.value)}
              placeholder="Description"
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
            <input type="number" name="item_quantity" value={item.quantity} min="0.01" step="0.01"
              onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))}
              className="w-20 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white text-right focus:outline-none focus:border-blue-500" />
            <input type="number" name="item_unit_price" value={item.unit_price} min="0" step="0.01"
              onChange={(e) => updateItem(i, 'unit_price', Number(e.target.value))}
              placeholder="Price"
              className="w-28 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white text-right focus:outline-none focus:border-blue-500" />
            <span className="w-24 px-3 py-2 text-sm text-gray-400 text-right">
              ${(item.quantity * item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <button type="button" onClick={() => removeItem(i)}
              className="px-2 py-2 text-red-400 hover:text-red-300 text-sm" title="Remove">
              &times;
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-3">
        <button type="button" onClick={addItem}
          className="text-sm text-blue-400 hover:text-blue-300">
          + Add Line Item
        </button>
        <p className="text-sm font-medium text-white">
          Total: ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create expense form**

Create `src/components/expense-form.tsx`:

```tsx
'use client';

import { useRef } from 'react';
import { createExpenseAction } from '@/lib/actions/expense-actions';
import type { Client } from '@/lib/types';

interface ExpenseFormProps {
  clients: Pick<Client, 'id' | 'name'>[];
}

export function ExpenseForm({ clients }: ExpenseFormProps) {
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    await createExpenseAction(formData);
    formRef.current?.reset();
  }

  return (
    <form ref={formRef} action={handleSubmit} className="p-4 bg-gray-900 border border-gray-800 rounded-lg mb-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <input type="date" name="expense_date" required defaultValue={new Date().toISOString().split('T')[0]}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
        <input type="text" name="description" required placeholder="Description"
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
        <select name="category" defaultValue="other"
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500">
          <option value="servers">Servers/Hosting</option>
          <option value="software">Software/APIs</option>
          <option value="contractor">Contractor</option>
          <option value="marketing">Marketing</option>
          <option value="other">Other</option>
        </select>
        <input type="number" name="amount" required step="0.01" min="0" placeholder="Amount"
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 text-right focus:outline-none focus:border-blue-500" />
        <select name="client_id" defaultValue=""
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500">
          <option value="">No client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="mt-3 flex justify-end">
        <button type="submit"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
          Add Expense
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Create revenue chart**

Create `src/components/revenue-chart.tsx`:

```tsx
import type { MonthlyRevenue } from '@/lib/queries/finance-queries';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function RevenueChart({ data }: { data: MonthlyRevenue[] }) {
  const maxAmount = Math.max(...data.map((d) => d.amount), 1);

  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold mb-4">Monthly Revenue (Last 12 Months)</h3>
      <div className="flex items-end gap-2 h-48">
        {data.map((d) => {
          const height = maxAmount > 0 ? (d.amount / maxAmount) * 100 : 0;
          const monthIndex = parseInt(d.month.split('-')[1], 10) - 1;
          return (
            <div key={d.month} className="flex-1 flex flex-col items-center">
              <span className="text-xs text-gray-400 mb-1">
                {d.amount > 0 ? `$${(d.amount / 1000).toFixed(d.amount >= 1000 ? 1 : 0)}k` : ''}
              </span>
              <div
                className="w-full bg-blue-600 rounded-t transition-all"
                style={{ height: `${Math.max(height, 2)}%` }}
                title={`${d.month}: $${d.amount.toLocaleString()}`}
              />
              <span className="text-xs text-gray-500 mt-1">{MONTH_LABELS[monthIndex]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create tab navigation**

Create `src/components/finance-tabs.tsx`:

```tsx
import Link from 'next/link';

const TABS = [
  { key: 'invoices', label: 'Invoices' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'profitability', label: 'Profitability' },
];

export function FinanceTabs({ active }: { active: string }) {
  return (
    <div className="flex gap-1 mb-6 border-b border-gray-800 pb-1">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.key === 'invoices' ? '/finances' : `/finances?tab=${tab.key}`}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            active === tab.key
              ? 'bg-gray-800 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
cd /Users/philipsmith/commandpost
git add src/components/invoice-line-items.tsx src/components/expense-form.tsx src/components/revenue-chart.tsx src/components/finance-tabs.tsx
git commit -m "feat: add finance UI components (line items, expense form, chart, tabs)"
```

---

### Task 7: Finances Pages (Main, New Invoice, Invoice Detail, Edit Invoice)

**Files:**
- Create: `src/app/(dashboard)/finances/page.tsx`
- Create: `src/app/(dashboard)/finances/invoices/new/page.tsx`
- Create: `src/app/(dashboard)/finances/invoices/[id]/page.tsx`
- Create: `src/app/(dashboard)/finances/invoices/[id]/edit/page.tsx`

- [ ] **Step 1: Create main finances page**

Create `src/app/(dashboard)/finances/page.tsx`:

```tsx
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { listInvoices, getInvoiceSummary } from '@/lib/queries/invoice-queries';
import { listExpenses, getExpenseMonthlyTotal } from '@/lib/queries/expense-queries';
import { getMonthlyRevenue, getProfitabilityByClient, getYtdStats, getRevenueByClient } from '@/lib/queries/finance-queries';
import { listClients } from '@/lib/queries/client-queries';
import { deleteExpenseAction } from '@/lib/actions/expense-actions';
import { FinanceTabs } from '@/components/finance-tabs';
import { ExpenseForm } from '@/components/expense-form';
import { RevenueChart } from '@/components/revenue-chart';
import { StatusBadge } from '@/components/status-badge';

export const dynamic = 'force-dynamic';

export default async function FinancesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; category?: string; month?: string; period?: string }>;
}) {
  const { tab = 'invoices', category, month, period } = await searchParams;
  const db = getDb();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Finances</h2>
        {tab === 'invoices' && (
          <Link href="/finances/invoices/new"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
            + New Invoice
          </Link>
        )}
      </div>

      <FinanceTabs active={tab} />

      {tab === 'invoices' && <InvoicesTab />}
      {tab === 'expenses' && <ExpensesTab category={category} month={month} />}
      {tab === 'revenue' && <RevenueTab />}
      {tab === 'profitability' && <ProfitabilityTab period={period} />}
    </div>
  );
}

function InvoicesTab() {
  const db = getDb();
  const invoices = listInvoices(db);
  const summary = getInvoiceSummary(db);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Outstanding</p>
          <p className="text-2xl font-bold text-white">${summary.totalOutstanding.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Overdue</p>
          <p className={`text-2xl font-bold ${summary.overdueCount > 0 ? 'text-red-400' : 'text-white'}`}>
            ${summary.totalOverdue.toLocaleString()}
          </p>
          {summary.overdueCount > 0 && <p className="text-xs text-red-400">{summary.overdueCount} invoice{summary.overdueCount > 1 ? 's' : ''}</p>}
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Paid This Month</p>
          <p className="text-2xl font-bold text-green-400">${summary.paidThisMonth.toLocaleString()}</p>
        </div>
      </div>

      {invoices.length === 0 ? (
        <p className="text-sm text-gray-500">No invoices yet. Create your first invoice to get started.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-500">
                <th className="pb-3 font-medium">Invoice</th>
                <th className="pb-3 font-medium">Client</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium text-right">Amount</th>
                <th className="pb-3 font-medium">Due Date</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                  <td className="py-3">
                    <Link href={`/finances/invoices/${inv.id}`} className="text-blue-400 hover:text-blue-300">
                      {inv.invoice_number}
                    </Link>
                  </td>
                  <td className="py-3 text-white">{inv.client_name}</td>
                  <td className="py-3">
                    <StatusBadge status={inv.is_overdue ? 'overdue' : inv.status} />
                  </td>
                  <td className="py-3 text-right text-white">${inv.total_amount.toLocaleString()}</td>
                  <td className={`py-3 ${inv.is_overdue ? 'text-red-400' : 'text-gray-400'}`}>{inv.due_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function ExpensesTab({ category, month }: { category?: string; month?: string }) {
  const db = getDb();
  const expenses = listExpenses(db, {
    category: category as any,
    month,
  });
  const clients = listClients(db).map(c => ({ id: c.id, name: c.name }));
  const currentMonth = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const monthlyTotal = getExpenseMonthlyTotal(db, currentMonth);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">
          Monthly total ({currentMonth}): <span className="text-white font-medium">${monthlyTotal.toLocaleString()}</span>
        </p>
      </div>

      <ExpenseForm clients={clients} />

      {expenses.length === 0 ? (
        <p className="text-sm text-gray-500">No expenses recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-500">
                <th className="pb-3 font-medium">Date</th>
                <th className="pb-3 font-medium">Description</th>
                <th className="pb-3 font-medium">Category</th>
                <th className="pb-3 font-medium text-right">Amount</th>
                <th className="pb-3 font-medium">Client</th>
                <th className="pb-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp) => (
                <tr key={exp.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                  <td className="py-3 text-gray-400">{exp.expense_date}</td>
                  <td className="py-3 text-white">{exp.description}</td>
                  <td className="py-3"><StatusBadge status={exp.category} /></td>
                  <td className="py-3 text-right text-white">${exp.amount.toLocaleString()}</td>
                  <td className="py-3 text-gray-400">{exp.client_name || '—'}</td>
                  <td className="py-3">
                    <form action={deleteExpenseAction}>
                      <input type="hidden" name="id" value={exp.id} />
                      <button type="submit" className="text-xs text-red-400 hover:text-red-300"
                        onClick={(e) => { if (!confirm('Delete this expense?')) e.preventDefault(); }}>
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function RevenueTab() {
  const db = getDb();
  const monthlyRevenue = getMonthlyRevenue(db);
  const ytd = getYtdStats(db);
  const topClients = getRevenueByClient(db);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">YTD Revenue</p>
          <p className="text-2xl font-bold text-green-400">${ytd.revenue.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">YTD Expenses</p>
          <p className="text-2xl font-bold text-red-400">${ytd.expenses.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">YTD Profit</p>
          <p className={`text-2xl font-bold ${ytd.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ${ytd.profit.toLocaleString()}
          </p>
        </div>
      </div>

      <RevenueChart data={monthlyRevenue} />

      {topClients.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Top Clients by Revenue</h3>
          <div className="space-y-2">
            {topClients.map((c) => (
              <div key={c.client_id} className="flex items-center justify-between p-3 bg-gray-900 border border-gray-800 rounded-lg">
                <span className="text-sm text-white">{c.client_name}</span>
                <span className="text-sm text-green-400">${c.total.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function ProfitabilityTab({ period }: { period?: string }) {
  const db = getDb();
  const profitability = getProfitabilityByClient(db, period || 'all');

  const periods = [
    { key: 'this_month', label: 'This Month' },
    { key: 'last_3_months', label: 'Last 3 Months' },
    { key: 'ytd', label: 'YTD' },
    { key: 'all', label: 'All Time' },
  ];

  return (
    <>
      <div className="flex gap-2 mb-6">
        {periods.map((p) => (
          <Link key={p.key} href={`/finances?tab=profitability&period=${p.key}`}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              (period || 'all') === p.key ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}>
            {p.label}
          </Link>
        ))}
      </div>

      {profitability.length === 0 ? (
        <p className="text-sm text-gray-500">No financial data for this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-500">
                <th className="pb-3 font-medium">Client</th>
                <th className="pb-3 font-medium text-right">Revenue</th>
                <th className="pb-3 font-medium text-right">Expenses</th>
                <th className="pb-3 font-medium text-right">Profit</th>
                <th className="pb-3 font-medium text-right">Margin</th>
              </tr>
            </thead>
            <tbody>
              {profitability.map((row) => (
                <tr key={row.client_id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                  <td className="py-3 text-white">{row.client_name}</td>
                  <td className="py-3 text-right text-green-400">${row.revenue.toLocaleString()}</td>
                  <td className="py-3 text-right text-red-400">${row.expenses.toLocaleString()}</td>
                  <td className={`py-3 text-right font-medium ${row.profit >= 0 ? 'text-white' : 'text-red-400'}`}>
                    ${row.profit.toLocaleString()}
                  </td>
                  <td className="py-3 text-right text-gray-400">
                    {row.margin !== null ? `${row.margin}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Create new invoice page**

Create `src/app/(dashboard)/finances/invoices/new/page.tsx`:

```tsx
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { listClients } from '@/lib/queries/client-queries';
import { createInvoiceAction } from '@/lib/actions/invoice-actions';
import { InvoiceLineItems } from '@/components/invoice-line-items';

export default function NewInvoicePage() {
  const db = getDb();
  const clients = listClients(db);

  return (
    <div className="p-6">
      <Link href="/finances" className="text-sm text-gray-400 hover:text-white mb-4 inline-block">
        &larr; Back to Finances
      </Link>
      <h2 className="text-2xl font-bold mb-6">New Invoice</h2>

      <form action={createInvoiceAction} className="space-y-4 max-w-2xl">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Client *</label>
            <select name="client_id" required
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500">
              <option value="">Select client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Due Date *</label>
            <input type="date" name="due_date" required
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
          </div>
        </div>

        <InvoiceLineItems />

        <div>
          <label className="block text-sm text-gray-400 mb-1">Notes</label>
          <textarea name="notes" rows={2}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input type="checkbox" name="is_recurring" className="rounded bg-gray-800 border-gray-700" />
            Recurring invoice
          </label>
          <div>
            <input type="number" name="recurrence_day" min="1" max="28" placeholder="Day (1-28)"
              className="w-32 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
          </div>
        </div>

        <button type="submit"
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
          Create Invoice
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Create invoice detail page**

Create `src/app/(dashboard)/finances/invoices/[id]/page.tsx`:

**CRITICAL Next.js 16:** `params` is a Promise. Use `await params`.

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getInvoiceById } from '@/lib/queries/invoice-queries';
import {
  markInvoiceSentAction,
  markInvoicePaidAction,
  deleteInvoiceAction,
  generateStripeLink,
  syncStripePaymentAction,
} from '@/lib/actions/invoice-actions';
import { isStripeConfigured } from '@/lib/stripe';
import { StatusBadge } from '@/components/status-badge';

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const invoice = getInvoiceById(db, Number(id));
  if (!invoice) notFound();

  const stripeEnabled = isStripeConfigured();
  const displayStatus = invoice.is_overdue ? 'overdue' : invoice.status;

  return (
    <div className="p-6">
      <Link href="/finances" className="text-sm text-gray-400 hover:text-white mb-4 inline-block">
        &larr; Back to Finances
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">{invoice.invoice_number}</h2>
          <Link href={`/clients/${invoice.client_id}`} className="text-gray-400 hover:text-white text-sm">
            {invoice.client_name}
          </Link>
        </div>
        <StatusBadge status={displayStatus} />
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Total</p>
          <p className="text-lg font-bold text-white">${invoice.total_amount.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Due Date</p>
          <p className={`text-sm ${invoice.is_overdue ? 'text-red-400' : 'text-white'}`}>{invoice.due_date}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Sent</p>
          <p className="text-sm text-white">{invoice.sent_at || '—'}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Paid</p>
          <p className="text-sm text-white">{invoice.paid_at || '—'}</p>
        </div>
      </div>

      {invoice.is_recurring === 1 && (
        <p className="text-sm text-gray-400 mb-4">Recurring on day {invoice.recurrence_day} of each month</p>
      )}

      {invoice.notes && (
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg mb-6">
          <p className="text-xs text-gray-500 uppercase mb-1">Notes</p>
          <p className="text-sm text-white">{invoice.notes}</p>
        </div>
      )}

      {/* Line Items */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">Line Items</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left text-gray-500">
              <th className="pb-2 font-medium">Description</th>
              <th className="pb-2 font-medium text-right">Qty</th>
              <th className="pb-2 font-medium text-right">Unit Price</th>
              <th className="pb-2 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id} className="border-b border-gray-800/50">
                <td className="py-2 text-white">{item.description}</td>
                <td className="py-2 text-right text-gray-400">{item.quantity}</td>
                <td className="py-2 text-right text-gray-400">${item.unit_price.toLocaleString()}</td>
                <td className="py-2 text-right text-white">${item.amount.toLocaleString()}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={3} className="py-3 text-right font-medium text-gray-400">Total</td>
              <td className="py-3 text-right font-bold text-white">${invoice.total_amount.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Stripe link */}
      {invoice.stripe_payment_link && (
        <div className="p-4 bg-blue-900/20 border border-blue-800 rounded-lg mb-6">
          <p className="text-sm text-blue-400">
            Payment link: <a href={invoice.stripe_payment_link} target="_blank" rel="noreferrer" className="underline">{invoice.stripe_payment_link}</a>
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3 mb-8">
        {invoice.status === 'draft' && (
          <>
            <Link href={`/finances/invoices/${invoice.id}/edit`}
              className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white hover:border-gray-600 transition-colors">
              Edit
            </Link>
            <form action={markInvoiceSentAction}>
              <input type="hidden" name="id" value={invoice.id} />
              <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
                Mark Sent
              </button>
            </form>
          </>
        )}
        {(invoice.status === 'sent' || invoice.is_overdue) && (
          <>
            <form action={markInvoicePaidAction}>
              <input type="hidden" name="id" value={invoice.id} />
              <button type="submit" className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">
                Mark Paid
              </button>
            </form>
            {stripeEnabled && !invoice.stripe_payment_link && (
              <form action={generateStripeLink}>
                <input type="hidden" name="id" value={invoice.id} />
                <button type="submit" className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors">
                  Generate Stripe Link
                </button>
              </form>
            )}
            {stripeEnabled && invoice.stripe_payment_link && (
              <form action={syncStripePaymentAction}>
                <input type="hidden" name="id" value={invoice.id} />
                <button type="submit" className="px-4 py-2 text-sm text-purple-400 border border-purple-800 rounded-lg hover:bg-purple-900/20 transition-colors">
                  Check Stripe Payment
                </button>
              </form>
            )}
          </>
        )}
        {invoice.status !== 'draft' && (
          <a href={`/api/invoices/${invoice.id}/pdf`}
            className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white hover:border-gray-600 transition-colors">
            Download PDF
          </a>
        )}
      </div>

      {/* Delete */}
      {invoice.status === 'draft' && (
        <div className="pt-6 border-t border-gray-800">
          <form action={deleteInvoiceAction}>
            <input type="hidden" name="id" value={invoice.id} />
            <button type="submit"
              className="px-4 py-2 text-sm text-red-400 border border-red-900 rounded-lg hover:bg-red-900/20 transition-colors"
              onClick={(e) => { if (!confirm('Delete this invoice?')) e.preventDefault(); }}>
              Delete Invoice
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create edit invoice page**

Create `src/app/(dashboard)/finances/invoices/[id]/edit/page.tsx`:

**CRITICAL Next.js 16:** `params` is a Promise. Use `await params`.

```tsx
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getInvoiceById } from '@/lib/queries/invoice-queries';
import { listClients } from '@/lib/queries/client-queries';
import { updateInvoiceAction } from '@/lib/actions/invoice-actions';
import { InvoiceLineItems } from '@/components/invoice-line-items';

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const invoice = getInvoiceById(db, Number(id));
  if (!invoice) notFound();
  if (invoice.status !== 'draft') redirect(`/finances/invoices/${id}`);

  const clients = listClients(db);

  return (
    <div className="p-6">
      <Link href={`/finances/invoices/${id}`} className="text-sm text-gray-400 hover:text-white mb-4 inline-block">
        &larr; Back to {invoice.invoice_number}
      </Link>
      <h2 className="text-2xl font-bold mb-6">Edit Invoice</h2>

      <form action={updateInvoiceAction} className="space-y-4 max-w-2xl">
        <input type="hidden" name="id" value={invoice.id} />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Client</label>
            <p className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">{invoice.client_name}</p>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Due Date *</label>
            <input type="date" name="due_date" required defaultValue={invoice.due_date}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
          </div>
        </div>

        <InvoiceLineItems initialItems={invoice.items.map(i => ({
          description: i.description,
          quantity: i.quantity,
          unit_price: i.unit_price,
        }))} />

        <div>
          <label className="block text-sm text-gray-400 mb-1">Notes</label>
          <textarea name="notes" rows={2} defaultValue={invoice.notes ?? ''}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input type="checkbox" name="is_recurring" defaultChecked={invoice.is_recurring === 1} className="rounded bg-gray-800 border-gray-700" />
            Recurring invoice
          </label>
          <input type="number" name="recurrence_day" min="1" max="28" placeholder="Day (1-28)"
            defaultValue={invoice.recurrence_day ?? ''}
            className="w-32 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
        </div>

        <button type="submit"
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
          Save Changes
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Add overdue and new statuses to StatusBadge**

In `src/components/status-badge.tsx`, add these entries to the `colors` object:

```typescript
  overdue: 'bg-red-500/20 text-red-400',
  draft: 'bg-gray-500/20 text-gray-400',
  sent: 'bg-blue-500/20 text-blue-400',
  paid: 'bg-green-500/20 text-green-400',
  servers: 'bg-purple-500/20 text-purple-400',
  software: 'bg-cyan-500/20 text-cyan-400',
  contractor: 'bg-orange-500/20 text-orange-400',
  marketing: 'bg-pink-500/20 text-pink-400',
  other: 'bg-gray-500/20 text-gray-400',
```

- [ ] **Step 6: Verify build**

```bash
cd /Users/philipsmith/commandpost && npx next build
```

Expected: Build succeeds with `/finances`, `/finances/invoices/new`, `/finances/invoices/[id]`, `/finances/invoices/[id]/edit` routes.

- [ ] **Step 7: Commit**

```bash
cd /Users/philipsmith/commandpost
git add "src/app/(dashboard)/finances/" src/components/status-badge.tsx
git commit -m "feat: add finances pages (invoices list, new, detail, edit with all tabs)"
```

---

### Task 8: Dashboard Integration

**Files:**
- Modify: `src/lib/queries/dashboard-queries.ts`
- Modify: `src/app/(dashboard)/page.tsx`
- Modify: `tests/queries/dashboard-queries.test.ts`

- [ ] **Step 1: Update dashboard queries**

In `src/lib/queries/dashboard-queries.ts`:

Add `outstandingInvoices` and `overdueInvoices` to `DashboardSummary`:

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
}
```

Add `'overdue_invoice'` to `ActionItem` type:

```typescript
export interface ActionItem {
  type: 'overdue_deliverable' | 'due_soon_deliverable' | 'missed_follow_up' | 'overdue_invoice';
  title: string;
  link: string;
  urgency: 'red' | 'yellow';
}
```

Add to `getDashboardSummary`, before the return:

```typescript
  const outstandingInvoices = (db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'sent'").get() as any).total;
  const overdueInvoiceAmount = (db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'sent' AND due_date < date('now')").get() as any).total;

  return { activeClients, overdueDeliverables, monthlyRevenue, pipelineLeads, pipelineValue, needsFollowUp, outstandingInvoices, overdueInvoiceAmount };
```

Add overdue invoices to `getActionItems`, after the missed follow-ups section:

```typescript
  // Overdue invoices
  const overdueInvoices = db.prepare(`
    SELECT i.id, i.invoice_number, i.total_amount, i.due_date, c.name as client_name
    FROM invoices i JOIN clients c ON i.client_id = c.id
    WHERE i.status = 'sent' AND i.due_date < date('now')
    ORDER BY i.due_date ASC
  `).all() as any[];

  for (const inv of overdueInvoices) {
    items.push({
      type: 'overdue_invoice',
      title: `Overdue invoice: ${inv.invoice_number} for ${inv.client_name} — $${inv.total_amount.toLocaleString()} due ${inv.due_date}`,
      link: `/finances/invoices/${inv.id}`,
      urgency: 'red',
    });
  }
```

- [ ] **Step 2: Update dashboard page**

In `src/app/(dashboard)/page.tsx`, replace the Overdue Items card with a Finances card:

```tsx
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Outstanding</p>
          <p className={`text-2xl font-bold ${summary.overdueInvoiceAmount > 0 ? 'text-red-400' : 'text-white'}`}>
            ${summary.outstandingInvoices.toLocaleString()}
          </p>
          {summary.overdueInvoiceAmount > 0 && (
            <p className="text-xs text-red-400">${summary.overdueInvoiceAmount.toLocaleString()} overdue</p>
          )}
        </div>
```

Also update the action items label display to handle `overdue_invoice`:

```tsx
                  {item.type === 'overdue_invoice' ? 'OVERDUE' : item.type === 'missed_follow_up' ? 'FOLLOW UP' : item.urgency === 'red' ? 'OVERDUE' : 'DUE SOON'}
```

- [ ] **Step 3: Add overdue invoice test**

Add to `tests/queries/dashboard-queries.test.ts`:

```typescript
  it('includes overdue invoices in action items', async () => {
    const { getActionItems } = await import('@/lib/queries/dashboard-queries');
    const clientId = Number(db.prepare("INSERT INTO clients (name, status) VALUES (?, ?)").run('Invoice Client', 'active').lastInsertRowid);
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, total_amount) VALUES (?, ?, ?, ?, ?)").run(clientId, 'INV-0001', 'sent', '2025-01-01', 5000);
    const items = getActionItems(db);
    const invoiceItems = items.filter(i => i.type === 'overdue_invoice');
    expect(invoiceItems).toHaveLength(1);
    expect(invoiceItems[0].title).toContain('INV-0001');
    expect(invoiceItems[0].urgency).toBe('red');
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
git commit -m "feat: add overdue invoice alerts and finance stats to dashboard"
```

---

### Task 9: PDF Invoice Generation

**Files:**
- Create: `src/app/api/invoices/[id]/pdf/route.ts`

- [ ] **Step 1: Install @react-pdf/renderer**

```bash
cd /Users/philipsmith/commandpost && npm install @react-pdf/renderer
```

- [ ] **Step 2: Create PDF route**

Create `src/app/api/invoices/[id]/pdf/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { getDb } from '@/lib/db';
import { getInvoiceById } from '@/lib/queries/invoice-queries';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  subheader: { fontSize: 12, color: '#666', marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { color: '#666', fontSize: 9 },
  value: { fontSize: 10 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ddd', paddingBottom: 4, marginBottom: 4 },
  tableRow: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#eee' },
  colDesc: { flex: 3 },
  colQty: { flex: 1, textAlign: 'right' },
  colPrice: { flex: 1, textAlign: 'right' },
  colAmount: { flex: 1, textAlign: 'right' },
  totalRow: { flexDirection: 'row', marginTop: 8, paddingTop: 8, borderTopWidth: 2, borderTopColor: '#333' },
  totalLabel: { flex: 5, textAlign: 'right', fontWeight: 'bold', fontSize: 12 },
  totalValue: { flex: 1, textAlign: 'right', fontWeight: 'bold', fontSize: 12 },
  section: { marginBottom: 20 },
  footer: { marginTop: 30, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#ddd', fontSize: 9, color: '#666' },
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const invoice = getInvoiceById(db, Number(id));

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  const businessName = process.env.BUSINESS_NAME || 'Phil Smith';

  const doc = React.createElement(Document, null,
    React.createElement(Page, { size: 'A4', style: styles.page },
      // Header
      React.createElement(Text, { style: styles.header }, 'INVOICE'),
      React.createElement(Text, { style: styles.subheader }, invoice.invoice_number),

      // From / To
      React.createElement(View, { style: styles.section },
        React.createElement(View, { style: styles.row },
          React.createElement(View, null,
            React.createElement(Text, { style: styles.label }, 'FROM'),
            React.createElement(Text, { style: styles.value }, businessName),
          ),
          React.createElement(View, null,
            React.createElement(Text, { style: styles.label }, 'TO'),
            React.createElement(Text, { style: styles.value }, invoice.client_name),
          ),
        ),
      ),

      // Details
      React.createElement(View, { style: styles.section },
        React.createElement(View, { style: styles.row },
          React.createElement(View, null,
            React.createElement(Text, { style: styles.label }, 'STATUS'),
            React.createElement(Text, { style: styles.value }, invoice.is_overdue ? 'OVERDUE' : invoice.status.toUpperCase()),
          ),
          React.createElement(View, null,
            React.createElement(Text, { style: styles.label }, 'DUE DATE'),
            React.createElement(Text, { style: styles.value }, invoice.due_date),
          ),
        ),
      ),

      // Line Items Table
      React.createElement(View, { style: styles.section },
        React.createElement(View, { style: styles.tableHeader },
          React.createElement(Text, { style: styles.colDesc }, 'Description'),
          React.createElement(Text, { style: styles.colQty }, 'Qty'),
          React.createElement(Text, { style: styles.colPrice }, 'Price'),
          React.createElement(Text, { style: styles.colAmount }, 'Amount'),
        ),
        ...invoice.items.map((item, i) =>
          React.createElement(View, { key: i, style: styles.tableRow },
            React.createElement(Text, { style: styles.colDesc }, item.description),
            React.createElement(Text, { style: styles.colQty }, String(item.quantity)),
            React.createElement(Text, { style: styles.colPrice }, `$${item.unit_price.toLocaleString()}`),
            React.createElement(Text, { style: styles.colAmount }, `$${item.amount.toLocaleString()}`),
          )
        ),
        React.createElement(View, { style: styles.totalRow },
          React.createElement(Text, { style: styles.totalLabel }, 'Total'),
          React.createElement(Text, { style: styles.totalValue }, `$${invoice.total_amount.toLocaleString()}`),
        ),
      ),

      // Notes
      invoice.notes ? React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.label }, 'NOTES'),
        React.createElement(Text, { style: styles.value }, invoice.notes),
      ) : null,

      // Stripe link
      invoice.stripe_payment_link ? React.createElement(View, { style: styles.footer },
        React.createElement(Text, null, `Pay online: ${invoice.stripe_payment_link}`),
      ) : null,
    )
  );

  const buffer = await renderToBuffer(doc);

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoice.invoice_number}.pdf"`,
    },
  });
}
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/philipsmith/commandpost && npx next build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
cd /Users/philipsmith/commandpost
git add "src/app/api/invoices/[id]/pdf/route.ts" package.json package-lock.json
git commit -m "feat: add PDF invoice generation endpoint"
```

---

### Task 10: Recurring Invoices Cron Script

**Files:**
- Create: `scripts/recurring-invoices.ts`

- [ ] **Step 1: Create the cron script**

Create `scripts/recurring-invoices.ts`:

```typescript
import { initDb } from '../src/lib/db';
import { createInvoice, getRecurringInvoicesDue } from '../src/lib/queries/invoice-queries';

const db = initDb();

function getNextDueDate(recurrenceDay: number): string {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth(); // 0-indexed

  // If we're past this month's recurrence day, target next month
  if (now.getDate() > recurrenceDay) {
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }

  const day = Math.min(recurrenceDay, new Date(year, month + 1, 0).getDate());
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function main() {
  const recurringInvoices = getRecurringInvoicesDue(db);
  const now = new Date();
  let created = 0;

  for (const invoice of recurringInvoices) {
    if (!invoice.recurrence_day) continue;

    const nextDue = getNextDueDate(invoice.recurrence_day);
    const nextDueDate = new Date(nextDue);
    const daysUntilDue = Math.floor((nextDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Only create if due within 7 days
    if (daysUntilDue > 7) continue;

    // Check if a draft already exists for this month
    const existingMonth = nextDue.substring(0, 7);
    const existing = db.prepare(
      "SELECT id FROM invoices WHERE client_id = ? AND status = 'draft' AND strftime('%Y-%m', due_date) = ?"
    ).get(invoice.client_id, existingMonth);

    if (existing) continue;

    // Clone the invoice
    const items = db.prepare('SELECT description, quantity, unit_price FROM invoice_items WHERE invoice_id = ?').all(invoice.id) as any[];

    const newId = createInvoice(db, {
      client_id: invoice.client_id,
      due_date: nextDue,
      notes: invoice.notes,
      is_recurring: true,
      recurrence_day: invoice.recurrence_day,
      items: items.map((i: any) => ({
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
      })),
    });

    console.log(`Created recurring invoice (id: ${newId}) for client ${invoice.client_id}, due ${nextDue}`);
    created++;
  }

  console.log(`Done. ${created} recurring invoice(s) created.`);
}

main();
```

- [ ] **Step 2: Add a run script to package.json**

Add to `scripts` in `package.json`:

```json
"cron:recurring": "npx tsx scripts/recurring-invoices.ts"
```

- [ ] **Step 3: Test the script runs without error**

```bash
cd /Users/philipsmith/commandpost && npx tsx scripts/recurring-invoices.ts
```

Expected: "Done. 0 recurring invoice(s) created." (no recurring invoices exist yet)

- [ ] **Step 4: Commit**

```bash
cd /Users/philipsmith/commandpost
git add scripts/recurring-invoices.ts package.json
git commit -m "feat: add recurring invoices cron script"
```

---

### Task 11: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/philipsmith/commandpost && npx vitest run
```

Expected: All tests pass.

- [ ] **Step 2: Production build**

```bash
cd /Users/philipsmith/commandpost && npx next build
```

Expected: Clean build with all finance routes registered.

- [ ] **Step 3: Manual smoke test**

Start dev server and test:
1. Navigate to Finances — empty invoices tab
2. Create a new invoice with 2 line items for an existing client
3. Invoice appears in list as Draft with auto-generated number INV-0001
4. Click into detail — see line items, total, actions
5. Click Edit — modify line items, save
6. Click Mark Sent — status changes, sent date recorded
7. Click Mark Paid — status changes to paid
8. Switch to Expenses tab — add an expense with a client
9. Switch to Revenue tab — see the paid invoice in the chart and YTD stats
10. Switch to Profitability tab — see client with revenue and expenses
11. Dashboard shows updated finance stats and overdue invoice alerts
12. Download PDF for a sent invoice — verify it opens

- [ ] **Step 4: Commit any fixes**

```bash
cd /Users/philipsmith/commandpost
git status
# If fixes needed:
git add -A && git commit -m "fix: adjustments from finances smoke testing"
```

---

## Phase 3 Complete

After this phase you have:
- Invoice CRUD with line items and auto-numbered invoices (INV-0001)
- Invoice status flow: Draft → Sent → Paid (Overdue computed)
- Stripe payment link generation (when STRIPE_SECRET_KEY configured)
- Stripe payment status sync
- PDF invoice download
- Recurring invoice auto-clone via cron
- Expense tracking with categories and client linking
- Revenue dashboard with 12-month bar chart, YTD stats, top clients
- Per-client profitability table with time period selector
- Dashboard integration: outstanding/overdue invoice amounts, overdue invoice action items

## Next Phases
- **Phase 4:** Ops Monitor (health checks, incident tracking)
- **Phase 5:** SMS Alerts (Twilio, morning briefing, scheduled summaries)
- **Phase 6:** Polish (mobile optimization, additional features)
