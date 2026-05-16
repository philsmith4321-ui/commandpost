# Client Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each client a unique, shareable URL showing their project progress, invoices, and activity — no login required.

**Architecture:** Add `portal_token` column to clients table. Public route at `/portal/[token]` with its own light-themed layout, outside the dashboard group. Token generated/reset via server actions on the admin client detail page.

**Tech Stack:** Next.js 16 App Router, better-sqlite3, Tailwind CSS v4, Vitest

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/lib/db.ts` | Migration: add `portal_token` column |
| `src/lib/queries/portal-queries.ts` | All portal data access functions |
| `src/lib/actions/portal-actions.ts` | Server actions for token generation/reset |
| `src/app/portal/layout.tsx` | Light theme layout for public portal |
| `src/app/portal/[token]/page.tsx` | Portal page (projects, invoices, activity) |
| `src/app/(dashboard)/clients/[id]/page.tsx` | Add portal link card |
| `src/components/portal-link-card.tsx` | Client-side card with copy/reset buttons |
| `tests/queries/portal-queries.test.ts` | Unit tests for portal queries |

---

### Task 1: Database Migration

**Files:**
- Modify: `src/lib/db.ts`

- [ ] **Step 1: Add portal_token migration**

In `src/lib/db.ts`, after the existing `hourly_rate` migration block (line ~213), add:

```typescript
  // Migration: add portal_token to clients
  const hasPortalToken = db.prepare("SELECT COUNT(*) as count FROM pragma_table_info('clients') WHERE name = 'portal_token'").get() as any;
  if (hasPortalToken.count === 0) {
    db.exec("ALTER TABLE clients ADD COLUMN portal_token TEXT");
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_portal_token ON clients(portal_token) WHERE portal_token IS NOT NULL");
  }
```

- [ ] **Step 2: Verify migration runs**

Run: `npx vitest run tests/queries/notification-queries.test.ts`
Expected: PASS (ensures initDb still works with new migration)

- [ ] **Step 3: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat(portal): add portal_token column migration to clients table"
```

---

### Task 2: Portal Queries

**Files:**
- Create: `src/lib/queries/portal-queries.ts`
- Create: `tests/queries/portal-queries.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/queries/portal-queries.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { initDb } from '@/lib/db';
import {
  getClientByPortalToken,
  getPortalProjects,
  getPortalInvoices,
  getPortalActivity,
  generatePortalToken,
  resetPortalToken,
} from '@/lib/queries/portal-queries';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeEach(() => {
  db = initDb(':memory:');
});

describe('generatePortalToken', () => {
  it('creates a token for client', () => {
    db.prepare("INSERT INTO clients (name, status) VALUES ('Acme', 'active')").run();
    const token = generatePortalToken(db, 1);
    expect(token).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('returns existing token if already set', () => {
    db.prepare("INSERT INTO clients (name, status) VALUES ('Acme', 'active')").run();
    const token1 = generatePortalToken(db, 1);
    const token2 = generatePortalToken(db, 1);
    expect(token1).toBe(token2);
  });
});

describe('resetPortalToken', () => {
  it('generates a new token replacing old one', () => {
    db.prepare("INSERT INTO clients (name, status) VALUES ('Acme', 'active')").run();
    const token1 = generatePortalToken(db, 1);
    const token2 = resetPortalToken(db, 1);
    expect(token2).not.toBe(token1);
    expect(token2).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('getClientByPortalToken', () => {
  it('returns client for valid token', () => {
    db.prepare("INSERT INTO clients (name, status) VALUES ('Acme', 'active')").run();
    const token = generatePortalToken(db, 1);
    const client = getClientByPortalToken(db, token);
    expect(client).toBeDefined();
    expect(client!.name).toBe('Acme');
  });

  it('returns undefined for invalid token', () => {
    const client = getClientByPortalToken(db, 'bad-token');
    expect(client).toBeUndefined();
  });

  it('returns undefined for deleted client', () => {
    db.prepare("INSERT INTO clients (name, status, deleted_at) VALUES ('Acme', 'active', datetime('now'))").run();
    const token = generatePortalToken(db, 1);
    const client = getClientByPortalToken(db, token);
    expect(client).toBeUndefined();
  });
});

describe('getPortalProjects', () => {
  it('returns active projects with deliverables', () => {
    db.prepare("INSERT INTO clients (name, status) VALUES ('Acme', 'active')").run();
    db.prepare("INSERT INTO projects (client_id, name, status) VALUES (1, 'Website', 'active')").run();
    db.prepare("INSERT INTO deliverables (project_id, title, status) VALUES (1, 'Homepage', 'delivered')").run();
    db.prepare("INSERT INTO deliverables (project_id, title, status) VALUES (1, 'About page', 'in_progress')").run();

    const projects = getPortalProjects(db, 1);
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe('Website');
    expect(projects[0].deliverables).toHaveLength(2);
  });

  it('excludes completed projects', () => {
    db.prepare("INSERT INTO clients (name, status) VALUES ('Acme', 'active')").run();
    db.prepare("INSERT INTO projects (client_id, name, status) VALUES (1, 'Old', 'completed')").run();
    db.prepare("INSERT INTO projects (client_id, name, status) VALUES (1, 'Current', 'active')").run();

    const projects = getPortalProjects(db, 1);
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe('Current');
  });
});

describe('getPortalInvoices', () => {
  it('returns outstanding and recent invoices', () => {
    db.prepare("INSERT INTO clients (name, status) VALUES ('Acme', 'active')").run();
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, total_amount) VALUES (1, 'INV-001', 'sent', '2026-06-01', 1000)").run();
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, total_amount, paid_at) VALUES (1, 'INV-002', 'paid', '2026-04-01', 500, '2026-04-05')").run();

    const invoices = getPortalInvoices(db, 1);
    expect(invoices.length).toBeGreaterThanOrEqual(1);
    expect(invoices[0].invoice_number).toBe('INV-001');
  });
});

describe('getPortalActivity', () => {
  it('returns recent notifications for client', () => {
    db.prepare("INSERT INTO clients (name, status) VALUES ('Acme', 'active')").run();
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, total_amount) VALUES (1, 'INV-001', 'paid', '2026-04-01', 500)").run();
    db.prepare("INSERT INTO notifications (type, title, message, link) VALUES ('invoice_paid', 'Invoice paid', '$500', '/finances/invoices/1')").run();

    const activity = getPortalActivity(db, 1);
    expect(activity).toHaveLength(1);
    expect(activity[0].title).toBe('Invoice paid');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/queries/portal-queries.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement portal queries**

Create `src/lib/queries/portal-queries.ts`:

```typescript
import type Database from 'better-sqlite3';
import crypto from 'crypto';

interface PortalClient {
  id: number;
  name: string;
  contact_person: string | null;
  email: string | null;
}

interface PortalDeliverable {
  id: number;
  title: string;
  status: string;
  due_date: string | null;
}

interface PortalProject {
  id: number;
  name: string;
  status: string;
  deliverables: PortalDeliverable[];
}

interface PortalInvoice {
  id: number;
  invoice_number: string;
  status: string;
  due_date: string;
  total_amount: number;
  stripe_payment_link: string | null;
}

interface PortalActivityItem {
  id: number;
  type: string;
  title: string;
  message: string | null;
  created_at: string;
}

export function generatePortalToken(db: Database.Database, clientId: number): string {
  const existing = db.prepare('SELECT portal_token FROM clients WHERE id = ?').get(clientId) as { portal_token: string | null } | undefined;
  if (existing?.portal_token) return existing.portal_token;

  const token = crypto.randomUUID();
  db.prepare('UPDATE clients SET portal_token = ? WHERE id = ?').run(token, clientId);
  return token;
}

export function resetPortalToken(db: Database.Database, clientId: number): string {
  const token = crypto.randomUUID();
  db.prepare('UPDATE clients SET portal_token = ? WHERE id = ?').run(token, clientId);
  return token;
}

export function getClientByPortalToken(db: Database.Database, token: string): PortalClient | undefined {
  return db.prepare(
    'SELECT id, name, contact_person, email FROM clients WHERE portal_token = ? AND deleted_at IS NULL'
  ).get(token) as PortalClient | undefined;
}

export function getPortalProjects(db: Database.Database, clientId: number): PortalProject[] {
  const projects = db.prepare(
    "SELECT id, name, status FROM projects WHERE client_id = ? AND status IN ('active', 'on-hold') ORDER BY created_at DESC"
  ).all(clientId) as { id: number; name: string; status: string }[];

  return projects.map(p => {
    const deliverables = db.prepare(
      'SELECT id, title, status, due_date FROM deliverables WHERE project_id = ? ORDER BY created_at ASC'
    ).all(p.id) as PortalDeliverable[];
    return { ...p, deliverables };
  });
}

export function getPortalInvoices(db: Database.Database, clientId: number): PortalInvoice[] {
  return db.prepare(`
    SELECT id, invoice_number, status, due_date, total_amount, stripe_payment_link
    FROM invoices
    WHERE client_id = ? AND (
      status = 'sent'
      OR (status = 'paid' AND paid_at >= date('now', '-90 days'))
    )
    ORDER BY
      CASE WHEN status = 'sent' THEN 0 ELSE 1 END,
      due_date DESC
  `).all(clientId) as PortalInvoice[];
}

export function getPortalActivity(db: Database.Database, clientId: number): PortalActivityItem[] {
  // Get invoice IDs for this client
  const invoiceIds = db.prepare(
    'SELECT id FROM invoices WHERE client_id = ?'
  ).all(clientId) as { id: number }[];

  if (invoiceIds.length === 0) {
    // Only client-linked notifications
    return db.prepare(`
      SELECT id, type, title, message, created_at FROM notifications
      WHERE link LIKE '/clients/' || ? || '%'
      ORDER BY created_at DESC LIMIT 10
    `).all(clientId) as PortalActivityItem[];
  }

  const placeholders = invoiceIds.map(() => '?').join(',');
  const invoicePaths = invoiceIds.map(i => `/finances/invoices/${i.id}`);

  return db.prepare(`
    SELECT id, type, title, message, created_at FROM notifications
    WHERE link LIKE '/clients/' || ? || '%'
       OR link IN (${placeholders})
    ORDER BY created_at DESC LIMIT 10
  `).all(clientId, ...invoicePaths) as PortalActivityItem[];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/queries/portal-queries.test.ts`
Expected: PASS (all 8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/portal-queries.ts tests/queries/portal-queries.test.ts
git commit -m "feat(portal): add portal queries with tests"
```

---

### Task 3: Server Actions

**Files:**
- Create: `src/lib/actions/portal-actions.ts`

- [ ] **Step 1: Create server actions**

Create `src/lib/actions/portal-actions.ts`:

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { generatePortalToken, resetPortalToken } from '@/lib/queries/portal-queries';

export async function generatePortalTokenAction(formData: FormData) {
  const db = getDb();
  const clientId = Number(formData.get('client_id'));
  generatePortalToken(db, clientId);
  revalidatePath(`/clients/${clientId}`);
}

export async function resetPortalTokenAction(formData: FormData) {
  const db = getDb();
  const clientId = Number(formData.get('client_id'));
  resetPortalToken(db, clientId);
  revalidatePath(`/clients/${clientId}`);
}
```

- [ ] **Step 2: Run full test suite to verify no breakage**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/portal-actions.ts
git commit -m "feat(portal): add server actions for token generation and reset"
```

---

### Task 4: Portal Layout (Light Theme)

**Files:**
- Create: `src/app/portal/layout.tsx`

- [ ] **Step 1: Create portal layout**

Create `src/app/portal/layout.tsx`:

```typescript
export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {children}
      </div>
      <footer className="text-center text-gray-400 text-xs pb-8">
        Powered by CommandPost
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/portal/layout.tsx
git commit -m "feat(portal): add light-themed portal layout"
```

---

### Task 5: Portal Page

**Files:**
- Create: `src/app/portal/[token]/page.tsx`

- [ ] **Step 1: Create portal page**

Create `src/app/portal/[token]/page.tsx`:

```typescript
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import {
  getClientByPortalToken,
  getPortalProjects,
  getPortalInvoices,
  getPortalActivity,
} from '@/lib/queries/portal-queries';

export const dynamic = 'force-dynamic';

export default async function PortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = getDb();
  const client = getClientByPortalToken(db, token);

  if (!client) {
    notFound();
  }

  const projects = getPortalProjects(db, client.id);
  const invoices = getPortalInvoices(db, client.id);
  const activity = getPortalActivity(db, client.id);

  const statusIcon: Record<string, string> = {
    not_started: '○',
    in_progress: '◐',
    delivered: '●',
  };

  const statusColor: Record<string, string> = {
    not_started: 'text-gray-400',
    in_progress: 'text-blue-500',
    delivered: 'text-green-500',
  };

  const invoiceStatusColor: Record<string, string> = {
    sent: 'bg-yellow-100 text-yellow-800',
    paid: 'bg-green-100 text-green-800',
    draft: 'bg-gray-100 text-gray-600',
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">{client.name}</h1>

      {/* Projects */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Projects</h2>
        {projects.length === 0 ? (
          <p className="text-gray-500 text-sm">No active projects.</p>
        ) : (
          <div className="space-y-4">
            {projects.map((project) => {
              const delivered = project.deliverables.filter(d => d.status === 'delivered').length;
              const total = project.deliverables.length;
              const pct = total > 0 ? Math.round((delivered / total) * 100) : 0;

              return (
                <div key={project.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-900">{project.name}</h3>
                    <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">
                      {project.status}
                    </span>
                  </div>
                  {total > 0 && (
                    <>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                        <div
                          className="bg-green-500 h-2 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mb-3">{delivered}/{total} deliverables complete ({pct}%)</p>
                      <ul className="space-y-1">
                        {project.deliverables.map((d) => (
                          <li key={d.id} className="flex items-center gap-2 text-sm">
                            <span className={statusColor[d.status]}>{statusIcon[d.status]}</span>
                            <span className="text-gray-700">{d.title}</span>
                            {d.due_date && <span className="text-gray-400 text-xs ml-auto">Due {d.due_date}</span>}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Invoices */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Invoices</h2>
        {invoices.length === 0 ? (
          <p className="text-gray-500 text-sm">No invoices.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-2 font-medium">Invoice</th>
                  <th className="pb-2 font-medium">Amount</th>
                  <th className="pb-2 font-medium">Due Date</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-gray-100">
                    <td className="py-3 text-gray-900">{inv.invoice_number}</td>
                    <td className="py-3 text-gray-900">${inv.total_amount.toLocaleString()}</td>
                    <td className="py-3 text-gray-600">{inv.due_date}</td>
                    <td className="py-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${invoiceStatusColor[inv.status]}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3">
                      {inv.status === 'sent' && inv.stripe_payment_link && (
                        <a
                          href={inv.stripe_payment_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        >
                          Pay Now
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Activity Feed */}
      {activity.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Recent Activity</h2>
          <div className="space-y-2">
            {activity.map((item) => (
              <div key={item.id} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
                <span className="text-gray-400 text-xs mt-0.5">
                  {new Date(item.created_at + 'Z').toLocaleDateString()}
                </span>
                <div>
                  <p className="text-sm text-gray-900">{item.title}</p>
                  {item.message && <p className="text-xs text-gray-500">{item.message}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | grep -E "(error|portal)"`
Expected: `/portal/[token]` appears in route list, no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/portal/layout.tsx src/app/portal/\[token\]/page.tsx
git commit -m "feat(portal): add public portal page with projects, invoices, activity"
```

---

### Task 6: Portal Link Card Component

**Files:**
- Create: `src/components/portal-link-card.tsx`

- [ ] **Step 1: Create the client component**

Create `src/components/portal-link-card.tsx`:

```typescript
'use client';

import { useRef, useState } from 'react';
import { generatePortalTokenAction, resetPortalTokenAction } from '@/lib/actions/portal-actions';

export function PortalLinkCard({ clientId, token }: { clientId: number; token: string | null }) {
  const [copied, setCopied] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const portalUrl = token ? `${typeof window !== 'undefined' ? window.location.origin : ''}/portal/${token}` : null;

  function handleCopy() {
    if (portalUrl) {
      navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleReset() {
    if (confirm('Reset portal link? The old link will stop working.')) {
      formRef.current?.requestSubmit();
    }
  }

  return (
    <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
      <h3 className="text-sm font-semibold text-white mb-3">Client Portal</h3>
      {token ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={portalUrl || ''}
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs truncate"
            />
            <button
              onClick={handleCopy}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <form ref={formRef} action={resetPortalTokenAction}>
            <input type="hidden" name="client_id" value={clientId} />
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              Reset Link
            </button>
          </form>
        </div>
      ) : (
        <form action={generatePortalTokenAction}>
          <input type="hidden" name="client_id" value={clientId} />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
          >
            Generate Portal Link
          </button>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/portal-link-card.tsx
git commit -m "feat(portal): add portal link card component"
```

---

### Task 7: Integrate Portal Card into Client Detail Page

**Files:**
- Modify: `src/app/(dashboard)/clients/[id]/page.tsx`

- [ ] **Step 1: Add import and render PortalLinkCard**

At the top of `src/app/(dashboard)/clients/[id]/page.tsx`, add import:

```typescript
import { PortalLinkCard } from '@/components/portal-link-card';
```

Then, after the health score section (the `{/* Health Score */}` block ending around `</div>`), insert:

```typescript
      {/* Client Portal */}
      <div className="mb-8">
        <PortalLinkCard clientId={client.id} token={(client as any).portal_token || null} />
      </div>
```

- [ ] **Step 2: Build and verify**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/clients/\[id\]/page.tsx
git commit -m "feat(portal): add portal link card to client detail page"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS (including new portal tests)

- [ ] **Step 2: Run build**

Run: `npm run build 2>&1 | grep -E "(error|portal|/portal)"`
Expected: `/portal/[token]` route listed, no errors

- [ ] **Step 3: Commit any remaining changes**

If clean, no action needed. Otherwise commit.
