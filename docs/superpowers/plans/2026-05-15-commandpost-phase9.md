# CommandPost Phase 9: Recurring Revenue & Client Health — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add computed client health scores with SMS alerts, and a full recurring invoice management UI with MRR tracking.

**Architecture:** Health scores are computed on-the-fly from existing data (payment speed, outstanding balance, engagement) — no new tables. Recurring invoice management builds on existing `is_recurring`/`recurrence_day` fields with new queries, server actions, and UI. Alerts integrate into the existing health-check and sms-alerts scripts.

**Tech Stack:** Next.js 16 (App Router), better-sqlite3, React 19 `useActionState`, Tailwind CSS v4, Vitest, Twilio SMS

---

## File Structure

```
src/
  lib/
    types.ts                             # MODIFY: add 'client_health_warning' to AlertType, add ClientHealth type
    queries/
      client-queries.ts                  # MODIFY: add getClientHealth, getClientHealthSummary
      invoice-queries.ts                 # MODIFY: add getRecurringInvoices, getMrr, getClientRecurringInvoices
      dashboard-queries.ts               # MODIFY: add MRR to DashboardSummary, client health to ActionItem type + getActionItems
      alert-queries.ts                   # MODIFY: add hasAlertBeenSentInLastDays
    actions/
      invoice-actions.ts                 # MODIFY: add toggleRecurringAction, updateRecurrenceDayAction, createRecurringInvoiceAction
  app/
    (dashboard)/
      page.tsx                           # MODIFY: add MRR stat card, pass health items through existing action items
      clients/
        page.tsx                         # MODIFY: add health indicator dots
        [id]/page.tsx                    # MODIFY: add health badge section, recurring invoices section
      finances/
        page.tsx                         # MODIFY: add Recurring tab
        invoices/[id]/page.tsx           # MODIFY: add recurrence toggle + day editor
  components/
    client-health-badge.tsx              # CREATE: reusable health score + status display
    recurring-invoice-form.tsx           # CREATE: form for creating recurring invoices
    finance-tabs.tsx                     # MODIFY: add 'Recurring' tab
scripts/
  health-check.ts                        # MODIFY: add client health alerting after endpoint checks
  sms-alerts.ts                          # MODIFY: add client health to Monday briefing
tests/
  queries/
    client-health.test.ts               # CREATE: test health score computation
    recurring-invoices.test.ts           # CREATE: test recurring invoice queries
```

---

### Task 1: Types and Alert Query Updates

**Files:**
- Modify: `src/lib/types.ts:153`
- Modify: `src/lib/queries/alert-queries.ts`

- [ ] **Step 1: Add `client_health_warning` to AlertType and add ClientHealth type**

In `src/lib/types.ts`, change line 153 from:

```typescript
export type AlertType = 'server_down' | 'server_recovered' | 'morning_briefing' | 'disk_warning';
```

to:

```typescript
export type AlertType = 'server_down' | 'server_recovered' | 'morning_briefing' | 'disk_warning' | 'client_health_warning';
```

And add at the end of the file (after `DiskReport` interface):

```typescript
export type ClientHealthStatus = 'healthy' | 'at_risk' | 'needs_attention';

export interface ClientHealth {
  clientId: number;
  clientName: string;
  score: number;
  status: ClientHealthStatus;
  payment: number;
  balance: number;
  engagement: number;
}
```

- [ ] **Step 2: Add `hasAlertBeenSentInLastDays` to alert-queries.ts**

Read `src/lib/queries/alert-queries.ts` first. Then add after the existing `hasAlertBeenSentToday` function:

```typescript
export function hasAlertBeenSentInLastDays(db: Database.Database, alertType: AlertType, referenceId: number, days: number): boolean {
  const row = db.prepare(
    "SELECT id FROM alerts_sent WHERE alert_type = ? AND reference_id = ? AND sent_at >= date('now', '-' || ? || ' days') LIMIT 1"
  ).get(alertType, referenceId, days);
  return !!row;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts src/lib/queries/alert-queries.ts
git commit -m "feat: add ClientHealth type and hasAlertBeenSentInLastDays query"
```

---

### Task 2: Client Health Score Queries + Tests

**Files:**
- Modify: `src/lib/queries/client-queries.ts`
- Create: `tests/queries/client-health.test.ts`

- [ ] **Step 1: Write the tests**

Create `tests/queries/client-health.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';

let db: Database.Database;
let initDb: typeof import('@/lib/db').initDb;
let getClientHealth: typeof import('@/lib/queries/client-queries').getClientHealth;
let getClientHealthSummary: typeof import('@/lib/queries/client-queries').getClientHealthSummary;

beforeEach(async () => {
  const dbModule = await import('../../src/lib/db');
  initDb = dbModule.initDb;
  db = initDb(`test-client-health-${Date.now()}-${Math.random()}.db`);
  const mod = await import('../../src/lib/queries/client-queries');
  getClientHealth = mod.getClientHealth;
  getClientHealthSummary = mod.getClientHealthSummary;
});

describe('getClientHealth', () => {
  it('returns healthy for client with fast payments, no outstanding, recent activity', () => {
    const clientId = db.prepare(
      "INSERT INTO clients (name, status) VALUES ('Good Client', 'active')"
    ).run().lastInsertRowid as number;

    // Paid invoice — 5 days to pay (within last 6 months)
    const invId = db.prepare(
      "INSERT INTO invoices (client_id, invoice_number, status, due_date, sent_at, paid_at, total_amount) VALUES (?, 'INV-0001', 'paid', '2026-05-01', '2026-04-20', '2026-04-25', 1000)"
    ).run(clientId).lastInsertRowid;
    db.prepare("INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (?, 'Work', 1, 1000, 1000)").run(invId);

    // Recent activity
    db.prepare(
      "INSERT INTO activity_logs (client_id, content, created_at) VALUES (?, 'Meeting notes', datetime('now'))"
    ).run(clientId);

    const health = getClientHealth(db, Number(clientId));
    expect(health.score).toBeGreaterThanOrEqual(70);
    expect(health.status).toBe('healthy');
    expect(health.payment).toBe(40);
    expect(health.balance).toBe(30);
    expect(health.engagement).toBe(30);
  });

  it('returns needs_attention for client with slow payments, overdue invoices, no activity', () => {
    const clientId = db.prepare(
      "INSERT INTO clients (name, status) VALUES ('Bad Client', 'active')"
    ).run().lastInsertRowid as number;

    // Slow payment — 45 days to pay
    const invId = db.prepare(
      "INSERT INTO invoices (client_id, invoice_number, status, due_date, sent_at, paid_at, total_amount) VALUES (?, 'INV-0002', 'paid', '2026-03-01', '2026-02-01', '2026-03-18', 500)"
    ).run(clientId).lastInsertRowid;
    db.prepare("INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (?, 'Work', 1, 500, 500)").run(invId);

    // Overdue sent invoice
    const inv2 = db.prepare(
      "INSERT INTO invoices (client_id, invoice_number, status, due_date, sent_at, total_amount) VALUES (?, 'INV-0003', 'sent', '2026-04-01', '2026-03-15', 800)"
    ).run(clientId).lastInsertRowid;
    db.prepare("INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (?, 'More work', 1, 800, 800)").run(inv2);

    // No activity logs — engagement = 0

    const health = getClientHealth(db, Number(clientId));
    expect(health.score).toBeLessThan(40);
    expect(health.status).toBe('needs_attention');
    expect(health.balance).toBe(0); // overdue
    expect(health.engagement).toBe(0); // no activity
  });

  it('returns neutral scores for new client with no invoices or activity', () => {
    const clientId = db.prepare(
      "INSERT INTO clients (name, status) VALUES ('New Client', 'active')"
    ).run().lastInsertRowid as number;

    const health = getClientHealth(db, Number(clientId));
    // payment=20 (neutral), balance=30 (nothing outstanding), engagement=0 (no activity)
    expect(health.payment).toBe(20);
    expect(health.balance).toBe(30);
    expect(health.engagement).toBe(0);
    expect(health.score).toBe(50);
    expect(health.status).toBe('at_risk');
  });

  it('getClientHealthSummary returns health for all active clients', () => {
    db.prepare("INSERT INTO clients (name, status) VALUES ('Client A', 'active')").run();
    db.prepare("INSERT INTO clients (name, status) VALUES ('Client B', 'active')").run();
    db.prepare("INSERT INTO clients (name, status, deleted_at) VALUES ('Deleted', 'active', datetime('now'))").run();
    db.prepare("INSERT INTO clients (name, status) VALUES ('Completed', 'completed')").run();

    const summary = getClientHealthSummary(db);
    expect(summary).toHaveLength(2);
    expect(summary.every(h => h.status)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/queries/client-health.test.ts`
Expected: FAIL — `getClientHealth` and `getClientHealthSummary` not exported.

- [ ] **Step 3: Implement `getClientHealth` and `getClientHealthSummary`**

Read `src/lib/queries/client-queries.ts` first. Add these imports at the top:

```typescript
import type { ClientHealth, ClientHealthStatus } from '@/lib/types';
```

Then add at the end of the file:

```typescript
export function getClientHealth(db: Database.Database, clientId: number): ClientHealth {
  const client = db.prepare("SELECT id, name FROM clients WHERE id = ?").get(clientId) as { id: number; name: string };

  // Payment speed (40 points) — avg days to pay in last 6 months
  const paymentRow = db.prepare(`
    SELECT AVG(julianday(paid_at) - julianday(sent_at)) as avg_days
    FROM invoices
    WHERE client_id = ? AND status = 'paid' AND sent_at IS NOT NULL
      AND paid_at >= date('now', '-6 months')
  `).get(clientId) as { avg_days: number | null };

  let payment: number;
  if (paymentRow.avg_days === null) {
    payment = 20; // neutral — no paid invoices
  } else if (paymentRow.avg_days <= 7) {
    payment = 40;
  } else if (paymentRow.avg_days <= 14) {
    payment = 30;
  } else if (paymentRow.avg_days <= 30) {
    payment = 20;
  } else {
    payment = 10;
  }

  // Outstanding balance (30 points)
  const outstanding = (db.prepare(
    "SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE client_id = ? AND status = 'sent'"
  ).get(clientId) as any).total;
  const overdue = (db.prepare(
    "SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE client_id = ? AND status = 'sent' AND due_date < date('now')"
  ).get(clientId) as any).total;

  let balance: number;
  if (outstanding === 0) {
    balance = 30;
  } else if (overdue > 0) {
    balance = 0;
  } else {
    balance = 15;
  }

  // Engagement (30 points) — days since last activity
  const lastActivity = db.prepare(
    "SELECT created_at FROM activity_logs WHERE client_id = ? ORDER BY created_at DESC LIMIT 1"
  ).get(clientId) as { created_at: string } | undefined;

  let engagement: number;
  if (!lastActivity) {
    engagement = 0;
  } else {
    const daysSince = (db.prepare(
      "SELECT julianday('now') - julianday(?) as days"
    ).get(lastActivity.created_at) as any).days;
    if (daysSince <= 7) {
      engagement = 30;
    } else if (daysSince <= 14) {
      engagement = 25;
    } else if (daysSince <= 30) {
      engagement = 15;
    } else if (daysSince <= 60) {
      engagement = 5;
    } else {
      engagement = 0;
    }
  }

  const score = payment + balance + engagement;
  let status: ClientHealthStatus;
  if (score >= 70) {
    status = 'healthy';
  } else if (score >= 40) {
    status = 'at_risk';
  } else {
    status = 'needs_attention';
  }

  return { clientId: client.id, clientName: client.name, score, status, payment, balance, engagement };
}

export function getClientHealthSummary(db: Database.Database): ClientHealth[] {
  const clients = db.prepare(
    "SELECT id FROM clients WHERE status = 'active' AND deleted_at IS NULL"
  ).all() as { id: number }[];

  return clients.map(c => getClientHealth(db, c.id));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/queries/client-health.test.ts`
Expected: All 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/client-queries.ts tests/queries/client-health.test.ts
git commit -m "feat: add client health score computation with tests"
```

---

### Task 3: Recurring Invoice Queries + Tests

**Files:**
- Modify: `src/lib/queries/invoice-queries.ts`
- Create: `tests/queries/recurring-invoices.test.ts`

- [ ] **Step 1: Write the tests**

Create `tests/queries/recurring-invoices.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';

let db: Database.Database;
let initDb: typeof import('@/lib/db').initDb;
let getRecurringInvoices: typeof import('@/lib/queries/invoice-queries').getRecurringInvoices;
let getMrr: typeof import('@/lib/queries/invoice-queries').getMrr;
let getClientRecurringInvoices: typeof import('@/lib/queries/invoice-queries').getClientRecurringInvoices;

beforeEach(async () => {
  const dbModule = await import('../../src/lib/db');
  initDb = dbModule.initDb;
  db = initDb(`test-recurring-inv-${Date.now()}-${Math.random()}.db`);
  const mod = await import('../../src/lib/queries/invoice-queries');
  getRecurringInvoices = mod.getRecurringInvoices;
  getMrr = mod.getMrr;
  getClientRecurringInvoices = mod.getClientRecurringInvoices;
});

describe('recurring invoice queries', () => {
  it('getRecurringInvoices returns only recurring invoices with client name', () => {
    const clientId = db.prepare("INSERT INTO clients (name, status) VALUES ('Acme', 'active')").run().lastInsertRowid;
    db.prepare(
      "INSERT INTO invoices (client_id, invoice_number, status, due_date, is_recurring, recurrence_day, total_amount) VALUES (?, 'INV-0001', 'sent', '2026-06-15', 1, 15, 2000)"
    ).run(clientId);
    db.prepare(
      "INSERT INTO invoices (client_id, invoice_number, status, due_date, is_recurring, recurrence_day, total_amount) VALUES (?, 'INV-0002', 'draft', '2026-06-01', 0, NULL, 500)"
    ).run(clientId);

    const recurring = getRecurringInvoices(db);
    expect(recurring).toHaveLength(1);
    expect(recurring[0].invoice_number).toBe('INV-0001');
    expect(recurring[0].client_name).toBe('Acme');
    expect(recurring[0].recurrence_day).toBe(15);
  });

  it('getMrr returns sum of all recurring invoice amounts', () => {
    const clientId = db.prepare("INSERT INTO clients (name, status) VALUES ('Acme', 'active')").run().lastInsertRowid;
    db.prepare(
      "INSERT INTO invoices (client_id, invoice_number, status, due_date, is_recurring, recurrence_day, total_amount) VALUES (?, 'INV-0001', 'sent', '2026-06-15', 1, 15, 2000)"
    ).run(clientId);
    db.prepare(
      "INSERT INTO invoices (client_id, invoice_number, status, due_date, is_recurring, recurrence_day, total_amount) VALUES (?, 'INV-0002', 'paid', '2026-05-15', 1, 15, 1500)"
    ).run(clientId);
    db.prepare(
      "INSERT INTO invoices (client_id, invoice_number, status, due_date, is_recurring, recurrence_day, total_amount) VALUES (?, 'INV-0003', 'draft', '2026-06-01', 0, NULL, 500)"
    ).run(clientId);

    expect(getMrr(db)).toBe(3500);
  });

  it('getMrr returns 0 when no recurring invoices exist', () => {
    expect(getMrr(db)).toBe(0);
  });

  it('getClientRecurringInvoices returns recurring invoices for a specific client', () => {
    const client1 = db.prepare("INSERT INTO clients (name, status) VALUES ('Client A', 'active')").run().lastInsertRowid;
    const client2 = db.prepare("INSERT INTO clients (name, status) VALUES ('Client B', 'active')").run().lastInsertRowid;
    db.prepare(
      "INSERT INTO invoices (client_id, invoice_number, status, due_date, is_recurring, recurrence_day, total_amount) VALUES (?, 'INV-0001', 'sent', '2026-06-15', 1, 15, 2000)"
    ).run(client1);
    db.prepare(
      "INSERT INTO invoices (client_id, invoice_number, status, due_date, is_recurring, recurrence_day, total_amount) VALUES (?, 'INV-0002', 'sent', '2026-06-01', 1, 1, 1000)"
    ).run(client2);

    const result = getClientRecurringInvoices(db, Number(client1));
    expect(result).toHaveLength(1);
    expect(result[0].invoice_number).toBe('INV-0001');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/queries/recurring-invoices.test.ts`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Implement the queries**

Read `src/lib/queries/invoice-queries.ts` first. Add a new interface after `InvoiceSummary`:

```typescript
export interface RecurringInvoiceRow {
  id: number;
  invoice_number: string;
  client_id: number;
  client_name: string;
  total_amount: number;
  recurrence_day: number;
  status: InvoiceStatus;
  is_recurring: number;
}
```

Then add these functions at the end of the file (before or after `setStripePaymentId`):

```typescript
export function getRecurringInvoices(db: Database.Database): RecurringInvoiceRow[] {
  return db.prepare(`
    SELECT i.id, i.invoice_number, i.client_id, c.name as client_name,
           i.total_amount, i.recurrence_day, i.status, i.is_recurring
    FROM invoices i JOIN clients c ON i.client_id = c.id
    WHERE i.is_recurring = 1
    ORDER BY c.name ASC
  `).all() as RecurringInvoiceRow[];
}

export function getMrr(db: Database.Database): number {
  return (db.prepare(
    "SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE is_recurring = 1"
  ).get() as any).total;
}

export function getClientRecurringInvoices(db: Database.Database, clientId: number): RecurringInvoiceRow[] {
  return db.prepare(`
    SELECT i.id, i.invoice_number, i.client_id, c.name as client_name,
           i.total_amount, i.recurrence_day, i.status, i.is_recurring
    FROM invoices i JOIN clients c ON i.client_id = c.id
    WHERE i.is_recurring = 1 AND i.client_id = ?
    ORDER BY i.recurrence_day ASC
  `).all(clientId) as RecurringInvoiceRow[];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/queries/recurring-invoices.test.ts`
Expected: All 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/invoice-queries.ts tests/queries/recurring-invoices.test.ts
git commit -m "feat: add recurring invoice queries with tests — getRecurringInvoices, getMrr, getClientRecurringInvoices"
```

---

### Task 4: Client Health Badge Component

**Files:**
- Create: `src/components/client-health-badge.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/client-health-badge.tsx`:

```tsx
import type { ClientHealth } from '@/lib/types';

const STATUS_COLORS = {
  healthy: { bg: 'bg-green-900/20', border: 'border-green-800', text: 'text-green-400', label: 'Healthy' },
  at_risk: { bg: 'bg-yellow-900/20', border: 'border-yellow-800', text: 'text-yellow-400', label: 'At Risk' },
  needs_attention: { bg: 'bg-red-900/20', border: 'border-red-800', text: 'text-red-400', label: 'Needs Attention' },
};

export function ClientHealthBadge({ health, showBreakdown = false }: { health: ClientHealth; showBreakdown?: boolean }) {
  const colors = STATUS_COLORS[health.status];

  return (
    <div className={`p-4 ${colors.bg} border ${colors.border} rounded-lg`}>
      <div className="flex items-center gap-3">
        <span className={`text-2xl font-bold ${colors.text}`}>{health.score}</span>
        <div>
          <span className={`text-sm font-medium ${colors.text}`}>{colors.label}</span>
          <p className="text-xs text-gray-500">Health Score</p>
        </div>
      </div>
      {showBreakdown && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-gray-500">Payment</p>
            <p className="text-white font-medium">{health.payment}/40</p>
          </div>
          <div>
            <p className="text-gray-500">Balance</p>
            <p className="text-white font-medium">{health.balance}/30</p>
          </div>
          <div>
            <p className="text-gray-500">Engagement</p>
            <p className="text-white font-medium">{health.engagement}/30</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function HealthDot({ status }: { status: ClientHealth['status'] }) {
  const dotColor = status === 'healthy' ? 'bg-green-400' : status === 'at_risk' ? 'bg-yellow-400' : 'bg-red-400';
  return <span className={`inline-block w-2 h-2 rounded-full ${dotColor}`} />;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/client-health-badge.tsx
git commit -m "feat: add ClientHealthBadge and HealthDot components"
```

---

### Task 5: Dashboard — MRR Stat + Client Health Action Items

**Files:**
- Modify: `src/lib/queries/dashboard-queries.ts`
- Modify: `src/app/(dashboard)/page.tsx`

- [ ] **Step 1: Update DashboardSummary and ActionItem types**

Read `src/lib/queries/dashboard-queries.ts` first. Add `mrr` to `DashboardSummary`:

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
  mrr: number;
}
```

Add `'client_needs_attention' | 'client_at_risk'` to the ActionItem type union:

```typescript
export interface ActionItem {
  type: 'overdue_deliverable' | 'due_soon_deliverable' | 'missed_follow_up' | 'overdue_invoice' | 'server_down' | 'client_needs_attention' | 'client_at_risk';
  title: string;
  link: string;
  urgency: 'red' | 'yellow';
}
```

- [ ] **Step 2: Add MRR to getDashboardSummary**

Add this import at the top:

```typescript
import { getMrr } from '@/lib/queries/invoice-queries';
```

In `getDashboardSummary`, add before the return:

```typescript
  const mrr = getMrr(db);
```

And add `mrr` to the return object.

- [ ] **Step 3: Add client health items to getActionItems**

Add this import at the top:

```typescript
import { getClientHealthSummary } from '@/lib/queries/client-queries';
```

At the end of `getActionItems`, before `return items;`, add:

```typescript
  // Client health
  const clientHealth = getClientHealthSummary(db);
  for (const h of clientHealth) {
    if (h.status === 'needs_attention') {
      items.push({
        type: 'client_needs_attention',
        title: `${h.clientName} — health ${h.score}/100`,
        link: `/clients/${h.clientId}`,
        urgency: 'red',
      });
    } else if (h.status === 'at_risk') {
      items.push({
        type: 'client_at_risk',
        title: `${h.clientName} — health ${h.score}/100`,
        link: `/clients/${h.clientId}`,
        urgency: 'yellow',
      });
    }
  }
```

- [ ] **Step 4: Add MRR card to dashboard page**

Read `src/app/(dashboard)/page.tsx` first. Change the grid from `md:grid-cols-5` to `md:grid-cols-6` and add a new MRR card after the Pipeline card (before the Servers card):

```tsx
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">MRR</p>
          <p className="text-2xl font-bold text-white">${summary.mrr.toLocaleString()}</p>
        </div>
```

- [ ] **Step 5: Update action item label rendering for new types**

In the same file, update the action item label `<span>` to handle the new types. Change the label logic inside the `actionItems.map` callback:

```tsx
                <span className={`text-xs font-medium uppercase ${item.urgency === 'red' ? 'text-red-400' : 'text-yellow-400'}`}>
                  {item.type === 'overdue_invoice' ? 'OVERDUE' : item.type === 'missed_follow_up' ? 'FOLLOW UP' : item.type === 'server_down' ? 'DOWN' : item.type === 'client_needs_attention' ? 'CLIENT' : item.type === 'client_at_risk' ? 'CLIENT' : item.urgency === 'red' ? 'OVERDUE' : 'DUE SOON'}
                </span>
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/queries/dashboard-queries.ts src/app/\(dashboard\)/page.tsx
git commit -m "feat: add MRR stat and client health action items to dashboard"
```

---

### Task 6: Client List Page — Health Indicator Dots

**Files:**
- Modify: `src/app/(dashboard)/clients/page.tsx`

- [ ] **Step 1: Add health dots to client list**

Read `src/app/(dashboard)/clients/page.tsx` first. Add imports:

```typescript
import { getClientHealth } from '@/lib/queries/client-queries';
import { HealthDot } from '@/components/client-health-badge';
import { getDb } from '@/lib/db';
```

Note: `getDb` is already imported. Only add the new imports.

After `const clients = listClients(db, filter);`, compute health for each client:

```typescript
  const clientsWithHealth = clients.map(client => ({
    ...client,
    health: getClientHealth(db, client.id),
  }));
```

Then in the JSX, change `clients.map` to `clientsWithHealth.map` and add the `HealthDot` before the client name:

```tsx
              <div className="flex items-center gap-2">
                <HealthDot status={client.health.status} />
                <span className="text-white font-medium">{client.name}</span>
                {client.contact_person && (
                  <span className="text-gray-500 text-sm ml-1">
                    {client.contact_person}
                  </span>
                )}
              </div>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/clients/page.tsx
git commit -m "feat: add health indicator dots to client list page"
```

---

### Task 7: Client Detail Page — Health Badge + Recurring Invoices

**Files:**
- Modify: `src/app/(dashboard)/clients/[id]/page.tsx`

- [ ] **Step 1: Add health badge and recurring invoices section**

Read `src/app/(dashboard)/clients/[id]/page.tsx` first. Add imports:

```typescript
import { getClientHealth } from '@/lib/queries/client-queries';
import { getClientRecurringInvoices } from '@/lib/queries/invoice-queries';
import { ClientHealthBadge } from '@/components/client-health-badge';
```

After the `activities` query, add:

```typescript
  const health = getClientHealth(db, Number(id));
  const recurringInvoices = getClientRecurringInvoices(db, Number(id));
```

In the JSX, add the health badge section right after the client info grid (`</div>` after the notes card, before the projects section):

```tsx
      {/* Health Score */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-white mb-3">Client Health</h3>
        <ClientHealthBadge health={health} showBreakdown />
      </div>

      {/* Recurring Invoices */}
      {recurringInvoices.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-white mb-3">Recurring Invoices</h3>
          <div className="space-y-2">
            {recurringInvoices.map((inv) => (
              <Link key={inv.id} href={`/finances/invoices/${inv.id}`}
                className="flex items-center justify-between p-3 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors">
                <div>
                  <span className="text-white text-sm font-medium">{inv.invoice_number}</span>
                  <span className="text-gray-500 text-xs ml-2">Day {inv.recurrence_day} of each month</span>
                </div>
                <span className="text-white text-sm">${inv.total_amount.toLocaleString()}/mo</span>
              </Link>
            ))}
          </div>
        </div>
      )}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/clients/\[id\]/page.tsx
git commit -m "feat: add health badge and recurring invoices to client detail page"
```

---

### Task 8: Invoice Actions — Toggle Recurring + Update Day + Create Recurring

**Files:**
- Modify: `src/lib/actions/invoice-actions.ts`

- [ ] **Step 1: Add three new server actions**

Read `src/lib/actions/invoice-actions.ts` first. Add `updateInvoice` to the existing imports from invoice-queries (it's already imported). Then add these actions at the end of the file:

```typescript
export async function toggleRecurringAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  const invoice = getInvoiceById(db, id);
  if (!invoice) return;

  updateInvoice(db, id, { is_recurring: !invoice.is_recurring });

  revalidatePath('/finances');
  revalidatePath(`/finances/invoices/${id}`);
  revalidatePath(`/clients/${invoice.client_id}`);
}

export async function updateRecurrenceDayAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  const day = Number(formData.get('day'));
  if (day < 1 || day > 28) return;

  const invoice = getInvoiceById(db, id);
  if (!invoice) return;

  updateInvoice(db, id, { recurrence_day: day });

  revalidatePath('/finances');
  revalidatePath(`/finances/invoices/${id}`);
  revalidatePath(`/clients/${invoice.client_id}`);
}

export async function createRecurringInvoiceAction(formData: FormData) {
  const db = getDb();
  const clientId = Number(formData.get('client_id'));
  const recurrenceDay = Number(formData.get('recurrence_day'));
  const descriptions = formData.getAll('item_description') as string[];
  const quantities = formData.getAll('item_quantity') as string[];
  const unitPrices = formData.getAll('item_unit_price') as string[];

  const items = descriptions.map((desc, i) => ({
    description: desc,
    quantity: Number(quantities[i]) || 1,
    unit_price: Number(unitPrices[i]) || 0,
  })).filter(item => item.description && item.unit_price > 0);

  if (items.length === 0 || recurrenceDay < 1 || recurrenceDay > 28) return;

  // Set due date to next occurrence of recurrence_day
  const now = new Date();
  let dueMonth = now.getMonth();
  let dueYear = now.getFullYear();
  if (now.getDate() >= recurrenceDay) {
    dueMonth += 1;
    if (dueMonth > 11) { dueMonth = 0; dueYear += 1; }
  }
  const dueDate = `${dueYear}-${String(dueMonth + 1).padStart(2, '0')}-${String(recurrenceDay).padStart(2, '0')}`;

  const id = createInvoice(db, {
    client_id: clientId,
    due_date: dueDate,
    is_recurring: true,
    recurrence_day: recurrenceDay,
    items,
  });

  revalidatePath('/finances');
  revalidatePath(`/clients/${clientId}`);
  redirect(`/finances/invoices/${id}`);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/invoice-actions.ts
git commit -m "feat: add toggleRecurring, updateRecurrenceDay, createRecurringInvoice actions"
```

---

### Task 9: Recurring Invoice Form Component

**Files:**
- Create: `src/components/recurring-invoice-form.tsx`

- [ ] **Step 1: Create the form component**

Create `src/components/recurring-invoice-form.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { createRecurringInvoiceAction } from '@/lib/actions/invoice-actions';

interface LineItem {
  description: string;
  quantity: string;
  unit_price: string;
}

export function RecurringInvoiceForm({ clientId }: { clientId: number }) {
  const [items, setItems] = useState<LineItem[]>([{ description: '', quantity: '1', unit_price: '' }]);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
        + Set Up Recurring Invoice
      </button>
    );
  }

  return (
    <form action={createRecurringInvoiceAction} className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
      <h4 className="text-sm font-medium text-white mb-3">New Recurring Invoice</h4>
      <input type="hidden" name="client_id" value={clientId} />

      <div className="mb-4">
        <label className="block text-xs text-gray-500 uppercase mb-1">Recurrence Day (1-28)</label>
        <input type="number" name="recurrence_day" min={1} max={28} defaultValue={1} required
          className="w-24 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
      </div>

      <div className="space-y-2 mb-4">
        <p className="text-xs text-gray-500 uppercase">Line Items</p>
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input type="text" name="item_description" placeholder="Description" required value={item.description}
              onChange={e => { const n = [...items]; n[i].description = e.target.value; setItems(n); }}
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
            <input type="number" name="item_quantity" placeholder="Qty" min={1} value={item.quantity}
              onChange={e => { const n = [...items]; n[i].quantity = e.target.value; setItems(n); }}
              className="w-16 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
            <input type="number" name="item_unit_price" placeholder="Price" step="0.01" min={0} required value={item.unit_price}
              onChange={e => { const n = [...items]; n[i].unit_price = e.target.value; setItems(n); }}
              className="w-24 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
            {items.length > 1 && (
              <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))}
                className="text-red-400 hover:text-red-300 text-sm px-2">Remove</button>
            )}
          </div>
        ))}
        <button type="button" onClick={() => setItems([...items, { description: '', quantity: '1', unit_price: '' }])}
          className="text-xs text-blue-400 hover:text-blue-300">+ Add line item</button>
      </div>

      <div className="flex gap-2">
        <button type="submit"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
          Create
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/recurring-invoice-form.tsx
git commit -m "feat: add RecurringInvoiceForm component"
```

---

### Task 10: Finances Page — Recurring Tab

**Files:**
- Modify: `src/components/finance-tabs.tsx`
- Modify: `src/app/(dashboard)/finances/page.tsx`

- [ ] **Step 1: Add Recurring tab to FinanceTabs**

Read `src/components/finance-tabs.tsx` first. Add `{ key: 'recurring', label: 'Recurring' }` to the `TABS` array:

```typescript
const TABS = [
  { key: 'invoices', label: 'Invoices' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'profitability', label: 'Profitability' },
  { key: 'recurring', label: 'Recurring' },
];
```

- [ ] **Step 2: Add RecurringTab to finances page**

Read `src/app/(dashboard)/finances/page.tsx` first. Add imports:

```typescript
import { getRecurringInvoices, getMrr } from '@/lib/queries/invoice-queries';
import { toggleRecurringAction } from '@/lib/actions/invoice-actions';
```

In the main `FinancesPage` component, add after `{tab === 'profitability' && ...}`:

```tsx
      {tab === 'recurring' && <RecurringTab />}
```

Then add the `RecurringTab` function at the end of the file:

```tsx
function RecurringTab() {
  const db = getDb();
  const recurring = getRecurringInvoices(db);
  const mrr = getMrr(db);
  const activeCount = recurring.length;

  // Next generation date: earliest recurrence_day in the future
  const today = new Date().getDate();
  const futureDays = recurring.map(r => r.recurrence_day).filter(d => d > today);
  const nextDay = futureDays.length > 0 ? Math.min(...futureDays) : (recurring.length > 0 ? Math.min(...recurring.map(r => r.recurrence_day)) : null);
  const now = new Date();
  let nextDate: string | null = null;
  if (nextDay !== null) {
    let m = now.getMonth();
    let y = now.getFullYear();
    if (nextDay <= today) { m += 1; if (m > 11) { m = 0; y += 1; } }
    nextDate = `${y}-${String(m + 1).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">MRR</p>
          <p className="text-2xl font-bold text-green-400">${mrr.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Active Recurring</p>
          <p className="text-2xl font-bold text-white">{activeCount}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Next Generation</p>
          <p className="text-sm font-medium text-white">{nextDate || '—'}</p>
        </div>
      </div>

      {recurring.length === 0 ? (
        <p className="text-sm text-gray-500">No recurring invoices set up. Mark an invoice as recurring from its detail page, or set one up from a client page.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-500">
                <th className="pb-3 font-medium">Invoice</th>
                <th className="pb-3 font-medium">Client</th>
                <th className="pb-3 font-medium text-right">Amount</th>
                <th className="pb-3 font-medium">Day</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {recurring.map((inv) => (
                <tr key={inv.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                  <td className="py-3">
                    <Link href={`/finances/invoices/${inv.id}`} className="text-blue-400 hover:text-blue-300">
                      {inv.invoice_number}
                    </Link>
                  </td>
                  <td className="py-3 text-white">{inv.client_name}</td>
                  <td className="py-3 text-right text-white">${inv.total_amount.toLocaleString()}</td>
                  <td className="py-3 text-gray-400">{inv.recurrence_day}</td>
                  <td className="py-3"><StatusBadge status={inv.status} /></td>
                  <td className="py-3">
                    <form action={toggleRecurringAction}>
                      <input type="hidden" name="id" value={inv.id} />
                      <button type="submit" className="text-xs text-red-400 hover:text-red-300">
                        Deactivate
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
```

- [ ] **Step 3: Commit**

```bash
git add src/components/finance-tabs.tsx src/app/\(dashboard\)/finances/page.tsx
git commit -m "feat: add Recurring tab to finances page with MRR stats and management"
```

---

### Task 11: Invoice Detail Page — Recurrence Controls

**Files:**
- Modify: `src/app/(dashboard)/finances/invoices/[id]/page.tsx`

- [ ] **Step 1: Add recurrence toggle and day editor**

Read `src/app/(dashboard)/finances/invoices/[id]/page.tsx` first. Add imports:

```typescript
import { toggleRecurringAction, updateRecurrenceDayAction } from '@/lib/actions/invoice-actions';
```

(Keep all existing imports.) Replace the existing recurring info paragraph (lines 63-65):

```tsx
      {invoice.is_recurring === 1 && (
        <p className="text-sm text-gray-400 mb-4">Recurring on day {invoice.recurrence_day} of each month</p>
      )}
```

With a more detailed section:

```tsx
      <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase mb-1">Recurring</p>
            <p className="text-sm text-white">
              {invoice.is_recurring === 1
                ? `Active — Day ${invoice.recurrence_day} of each month`
                : 'Not recurring'}
            </p>
          </div>
          <form action={toggleRecurringAction}>
            <input type="hidden" name="id" value={invoice.id} />
            <button type="submit"
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                invoice.is_recurring === 1
                  ? 'text-red-400 border border-red-900 hover:bg-red-900/20'
                  : 'text-green-400 border border-green-900 hover:bg-green-900/20'
              }`}>
              {invoice.is_recurring === 1 ? 'Deactivate' : 'Activate'}
            </button>
          </form>
        </div>
        {invoice.is_recurring === 1 && (
          <form action={updateRecurrenceDayAction} className="mt-3 flex items-center gap-2">
            <input type="hidden" name="id" value={invoice.id} />
            <label className="text-xs text-gray-500">Change day:</label>
            <input type="number" name="day" min={1} max={28} defaultValue={invoice.recurrence_day ?? 1}
              className="w-16 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm" />
            <button type="submit"
              className="px-3 py-1 text-xs text-blue-400 border border-blue-800 rounded hover:bg-blue-900/20 transition-colors">
              Update
            </button>
          </form>
        )}
      </div>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/finances/invoices/\[id\]/page.tsx
git commit -m "feat: add recurrence toggle and day editor to invoice detail page"
```

---

### Task 12: Client Detail — Recurring Invoice Form

**Files:**
- Modify: `src/app/(dashboard)/clients/[id]/page.tsx`

- [ ] **Step 1: Add recurring invoice form to client detail page**

Read `src/app/(dashboard)/clients/[id]/page.tsx` first. Add import:

```typescript
import { RecurringInvoiceForm } from '@/components/recurring-invoice-form';
```

In the recurring invoices section (added in Task 7), add the form after the invoice list, inside the same block. If there are no recurring invoices, show just the form. Update the recurring invoices section to:

```tsx
      {/* Recurring Invoices */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-white mb-3">Recurring Invoices</h3>
        {recurringInvoices.length > 0 && (
          <div className="space-y-2 mb-4">
            {recurringInvoices.map((inv) => (
              <Link key={inv.id} href={`/finances/invoices/${inv.id}`}
                className="flex items-center justify-between p-3 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors">
                <div>
                  <span className="text-white text-sm font-medium">{inv.invoice_number}</span>
                  <span className="text-gray-500 text-xs ml-2">Day {inv.recurrence_day} of each month</span>
                </div>
                <span className="text-white text-sm">${inv.total_amount.toLocaleString()}/mo</span>
              </Link>
            ))}
          </div>
        )}
        {recurringInvoices.length === 0 && (
          <p className="text-sm text-gray-500 mb-4">No recurring invoices for this client.</p>
        )}
        <RecurringInvoiceForm clientId={client.id} />
      </div>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/clients/\[id\]/page.tsx
git commit -m "feat: add recurring invoice form to client detail page"
```

---

### Task 13: Health Check Script — Client Health Alerts

**Files:**
- Modify: `scripts/health-check.ts`

- [ ] **Step 1: Add client health alerting**

Read `scripts/health-check.ts` first. Add imports at the top:

```typescript
import { getClientHealthSummary } from '../src/lib/queries/client-queries';
import { hasAlertBeenSentInLastDays } from '../src/lib/queries/alert-queries';
```

At the end of the `main()` function, after the data retention section and before `db.close()`, add:

```typescript
  // Client health alerts
  const clientHealth = getClientHealthSummary(db);
  for (const h of clientHealth) {
    if (h.status === 'needs_attention') {
      if (!hasAlertBeenSentInLastDays(db, 'client_health_warning', h.clientId, 7)) {
        const message = `ALERT: ${h.clientName} needs attention — health score ${h.score}/100`;
        console.log(`Client health alert: ${message}`);
        if (isTwilioConfigured()) {
          const sent = await sendSms(message);
          if (sent) {
            recordAlert(db, { alert_type: 'client_health_warning', reference_id: h.clientId, message });
            console.log(`  SMS SENT: ${message}`);
          }
        }
      }
    }
  }
```

- [ ] **Step 2: Commit**

```bash
git add scripts/health-check.ts
git commit -m "feat: add client health warning alerts to health check script"
```

---

### Task 14: SMS Alerts — Monday Briefing Client Health

**Files:**
- Modify: `scripts/sms-alerts.ts`

- [ ] **Step 1: Add client health to Monday briefing**

Read `scripts/sms-alerts.ts` first. Add import at the top:

```typescript
import { getClientHealthSummary } from '../src/lib/queries/client-queries';
```

In the `morningBriefing` function, inside the `if (isMonday)` block, after the AI insights section (after the closing `}` of `if (isClaudeConfigured())`), add:

```typescript
    // Client health summary
    const clientHealth = getClientHealthSummary(db);
    const needsAttention = clientHealth.filter(h => h.status === 'needs_attention').length;
    const atRisk = clientHealth.filter(h => h.status === 'at_risk').length;
    if (needsAttention > 0 || atRisk > 0) {
      const healthParts: string[] = [];
      if (needsAttention > 0) healthParts.push(`${needsAttention} need${needsAttention === 1 ? 's' : ''} attention`);
      if (atRisk > 0) healthParts.push(`${atRisk} at risk`);
      parts.push(`Client health: ${healthParts.join(', ')}`);
    }
```

- [ ] **Step 2: Commit**

```bash
git add scripts/sms-alerts.ts
git commit -m "feat: add client health summary to Monday morning briefing"
```

---

### Task 15: Final Verification

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: All tests pass (76 existing + 8 new = 84 total).

- [ ] **Step 2: Run the build**

Run: `npm run build`
Expected: Clean build, no errors.

- [ ] **Step 3: Verify new files exist**

Run: `ls -la src/components/client-health-badge.tsx src/components/recurring-invoice-form.tsx tests/queries/client-health.test.ts tests/queries/recurring-invoices.test.ts`
Expected: All 4 new files exist.
