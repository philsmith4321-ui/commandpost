# Phase 12: Email & Notifications — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dual-channel notification system with in-app notifications (bell icon + page) and email alerts (immediate for critical, daily digest, user-configurable per type) via Resend.

**Architecture:** New `notifications` and `notification_preferences` tables. A `createNotification()` function handles both in-app storage and email dispatch. Two cron API routes check for events and send digests. UI includes a bell icon in the sidebar, a `/notifications` page, and a `/settings/notifications` preferences page.

**Tech Stack:** Next.js 16 (App Router), better-sqlite3, Tailwind CSS v4 dark theme, Resend REST API via fetch, Vitest.

---

## File Structure

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `src/lib/db.ts` | Add notifications + notification_preferences tables |
| Modify | `src/lib/types.ts` | Add Notification, NotificationPreference types |
| Create | `src/lib/email.ts` | Resend integration (sendEmail function) |
| Create | `src/lib/email-templates.ts` | HTML builders for alert + digest emails |
| Create | `src/lib/queries/notification-queries.ts` | All notification query/mutation functions |
| Create | `src/lib/notifications.ts` | createNotification() orchestrator |
| Create | `src/lib/actions/notification-actions.ts` | Server actions (markRead, updatePreference) |
| Create | `src/components/notification-bell.tsx` | Bell icon with dropdown (client component) |
| Create | `src/app/(dashboard)/notifications/page.tsx` | Full notifications page |
| Create | `src/app/(dashboard)/settings/notifications/page.tsx` | Preferences page |
| Create | `src/app/api/cron/notifications/route.ts` | Event-checking cron endpoint |
| Create | `src/app/api/cron/digest/route.ts` | Daily digest cron endpoint |
| Modify | `src/components/sidebar.tsx` | Add bell icon |
| Modify | `src/components/mobile-nav.tsx` | Add notifications nav item |
| Modify | `src/lib/actions/invoice-actions.ts` | Add notification on invoice paid |
| Modify | `src/lib/actions/lead-actions.ts` | Add notification on stage change |
| Modify | `src/lib/actions/time-actions.ts` | Add notification on time invoiced |
| Create | `tests/queries/notification-queries.test.ts` | Query tests |
| Create | `tests/notifications.test.ts` | createNotification tests |
| Create | `tests/email-templates.test.ts` | Template output tests |

---

### Task 1: Database Schema — notifications + preferences tables

**Files:**
- Modify: `src/lib/db.ts`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add notifications table to db.ts**

In `src/lib/db.ts`, add after the `time_entries` CREATE TABLE (inside the `db.exec` block):

```sql
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      link TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notification_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      notification_type TEXT NOT NULL UNIQUE,
      email_delivery TEXT NOT NULL DEFAULT 'digest' CHECK(email_delivery IN ('immediate','digest','none'))
    );
```

- [ ] **Step 2: Add types to types.ts**

Add at the end of `src/lib/types.ts`:

```typescript
export type NotificationType =
  | 'server_down'
  | 'server_recovered'
  | 'client_health_critical'
  | 'invoice_overdue'
  | 'invoice_paid'
  | 'deliverable_overdue'
  | 'follow_up_due'
  | 'lead_stage_changed'
  | 'time_invoiced';

export type EmailDelivery = 'immediate' | 'digest' | 'none';

export interface Notification {
  id: number;
  type: NotificationType;
  title: string;
  message: string | null;
  link: string | null;
  is_read: number;
  created_at: string;
}

export interface NotificationPreference {
  id: number;
  notification_type: NotificationType;
  email_delivery: EmailDelivery;
}
```

- [ ] **Step 3: Build to verify**

Run: `cd /Users/philipsmith/commandpost && npm run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/lib/db.ts src/lib/types.ts
git commit -m "feat(notifications): add notifications and preferences tables"
```

---

### Task 2: Email integration (Resend)

**Files:**
- Create: `src/lib/email.ts`
- Create: `src/lib/email-templates.ts`
- Create: `tests/email-templates.test.ts`

- [ ] **Step 1: Create email.ts**

Create `src/lib/email.ts`:

```typescript
const RESEND_API_URL = 'https://api.resend.com/emails';

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_FROM_EMAIL || 'CommandPost <noreply@commandpost.rekindleleads.com>';

  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set, skipping email send');
    return false;
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[email] Resend API error ${res.status}: ${body}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[email] Failed to send:', err);
    return false;
  }
}
```

- [ ] **Step 2: Create email-templates.ts**

Create `src/lib/email-templates.ts`:

```typescript
interface DigestItem {
  title: string;
  message: string | null;
  link: string | null;
  type: string;
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://commandpost.rekindleleads.com';

function layout(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#111;color:#fff;padding:32px;margin:0;">
  <div style="max-width:600px;margin:0 auto;">
    <h1 style="font-size:20px;color:#fff;margin-bottom:24px;">CommandPost</h1>
    ${content}
    <p style="margin-top:32px;font-size:12px;color:#666;">
      <a href="${BASE_URL}" style="color:#3b82f6;">Open CommandPost</a>
    </p>
  </div>
</body>
</html>`;
}

export function buildAlertEmail(title: string, message: string | null, link: string | null): string {
  const linkHtml = link ? `<p><a href="${BASE_URL}${link}" style="color:#3b82f6;text-decoration:underline;">View in CommandPost</a></p>` : '';
  return layout(`
    <div style="background:#1f2937;border:1px solid #374151;border-radius:8px;padding:20px;">
      <h2 style="font-size:16px;color:#f87171;margin:0 0 8px 0;">${title}</h2>
      ${message ? `<p style="color:#d1d5db;margin:0 0 12px 0;">${message}</p>` : ''}
      ${linkHtml}
    </div>
  `);
}

export function buildDigestEmail(items: DigestItem[]): string {
  if (items.length === 0) return '';

  const grouped: Record<string, DigestItem[]> = {};
  for (const item of items) {
    const key = item.type.replace(/_/g, ' ');
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  }

  let sections = '';
  for (const [type, typeItems] of Object.entries(grouped)) {
    sections += `<h3 style="font-size:14px;color:#9ca3af;text-transform:uppercase;margin:20px 0 8px 0;">${type}</h3>`;
    for (const item of typeItems) {
      const linkHtml = item.link ? ` <a href="${BASE_URL}${item.link}" style="color:#3b82f6;font-size:12px;">View</a>` : '';
      sections += `<div style="background:#1f2937;border:1px solid #374151;border-radius:6px;padding:12px;margin-bottom:8px;">
        <p style="color:#fff;margin:0;font-size:14px;">${item.title}${linkHtml}</p>
        ${item.message ? `<p style="color:#9ca3af;margin:4px 0 0 0;font-size:13px;">${item.message}</p>` : ''}
      </div>`;
    }
  }

  return layout(`
    <h2 style="font-size:16px;color:#fff;margin:0 0 16px 0;">Daily Digest</h2>
    <p style="color:#9ca3af;font-size:13px;margin:0 0 16px 0;">${items.length} notification${items.length === 1 ? '' : 's'} from the last 24 hours</p>
    ${sections}
  `);
}
```

- [ ] **Step 3: Write template tests**

Create `tests/email-templates.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildAlertEmail, buildDigestEmail } from '@/lib/email-templates';

describe('buildAlertEmail', () => {
  it('includes title and message in output', () => {
    const html = buildAlertEmail('Server Down', 'api.example.com is not responding', '/ops/1');
    expect(html).toContain('Server Down');
    expect(html).toContain('api.example.com is not responding');
    expect(html).toContain('/ops/1');
  });

  it('handles null message and link', () => {
    const html = buildAlertEmail('Test Alert', null, null);
    expect(html).toContain('Test Alert');
    expect(html).toContain('CommandPost');
  });
});

describe('buildDigestEmail', () => {
  it('groups items by type', () => {
    const items = [
      { title: 'Invoice #101 overdue', message: '$500', link: '/finances/invoices/1', type: 'invoice_overdue' },
      { title: 'Invoice #102 overdue', message: '$300', link: '/finances/invoices/2', type: 'invoice_overdue' },
      { title: 'Follow up with Acme', message: null, link: '/pipeline/5', type: 'follow_up_due' },
    ];
    const html = buildDigestEmail(items);
    expect(html).toContain('invoice overdue');
    expect(html).toContain('follow up due');
    expect(html).toContain('3 notifications');
  });

  it('returns empty string for no items', () => {
    expect(buildDigestEmail([])).toBe('');
  });
});
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/philipsmith/commandpost && npx vitest run tests/email-templates.test.ts`
Expected: All 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/email.ts src/lib/email-templates.ts tests/email-templates.test.ts
git commit -m "feat(notifications): add email integration and HTML templates"
```

---

### Task 3: Notification queries

**Files:**
- Create: `src/lib/queries/notification-queries.ts`
- Create: `tests/queries/notification-queries.test.ts`

- [ ] **Step 1: Write tests**

Create `tests/queries/notification-queries.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { initDb } from '@/lib/db';
import {
  insertNotification,
  getUnreadCount,
  getRecentNotifications,
  getNotificationsFiltered,
  markNotificationRead,
  markAllRead,
  getNotificationPreferences,
  upsertPreference,
  getDigestNotifications,
} from '@/lib/queries/notification-queries';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeEach(() => {
  db = initDb(':memory:');
});

describe('insertNotification', () => {
  it('inserts and returns id', () => {
    const id = insertNotification(db, { type: 'invoice_paid', title: 'Invoice paid', message: '$500', link: '/finances/invoices/1' });
    expect(id).toBe(1);
  });
});

describe('getUnreadCount', () => {
  it('counts unread notifications', () => {
    insertNotification(db, { type: 'invoice_paid', title: 'A', message: null, link: null });
    insertNotification(db, { type: 'invoice_paid', title: 'B', message: null, link: null });
    db.exec("UPDATE notifications SET is_read = 1 WHERE id = 1");
    expect(getUnreadCount(db)).toBe(1);
  });
});

describe('getRecentNotifications', () => {
  it('returns notifications ordered by created_at desc', () => {
    insertNotification(db, { type: 'invoice_paid', title: 'First', message: null, link: null });
    insertNotification(db, { type: 'server_down', title: 'Second', message: null, link: null });
    const results = getRecentNotifications(db, 10);
    expect(results).toHaveLength(2);
    expect(results[0].title).toBe('Second');
  });
});

describe('markNotificationRead', () => {
  it('marks a single notification as read', () => {
    insertNotification(db, { type: 'invoice_paid', title: 'Test', message: null, link: null });
    markNotificationRead(db, 1);
    expect(getUnreadCount(db)).toBe(0);
  });
});

describe('markAllRead', () => {
  it('marks all as read', () => {
    insertNotification(db, { type: 'invoice_paid', title: 'A', message: null, link: null });
    insertNotification(db, { type: 'invoice_paid', title: 'B', message: null, link: null });
    markAllRead(db);
    expect(getUnreadCount(db)).toBe(0);
  });
});

describe('getNotificationPreferences', () => {
  it('returns defaults for all types when table is empty', () => {
    const prefs = getNotificationPreferences(db);
    expect(prefs.length).toBeGreaterThan(0);
    const serverDown = prefs.find(p => p.notification_type === 'server_down');
    expect(serverDown?.email_delivery).toBe('immediate');
  });
});

describe('upsertPreference', () => {
  it('inserts and updates preference', () => {
    upsertPreference(db, 'invoice_paid', 'none');
    const prefs = getNotificationPreferences(db);
    const pref = prefs.find(p => p.notification_type === 'invoice_paid');
    expect(pref?.email_delivery).toBe('none');
  });
});

describe('getDigestNotifications', () => {
  it('returns unread notifications with digest preference', () => {
    upsertPreference(db, 'invoice_paid', 'digest');
    upsertPreference(db, 'server_down', 'immediate');
    insertNotification(db, { type: 'invoice_paid', title: 'Paid', message: null, link: null });
    insertNotification(db, { type: 'server_down', title: 'Down', message: null, link: null });
    const digest = getDigestNotifications(db);
    expect(digest).toHaveLength(1);
    expect(digest[0].title).toBe('Paid');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/philipsmith/commandpost && npx vitest run tests/queries/notification-queries.test.ts 2>&1 | tail -10`
Expected: FAIL �� module not found

- [ ] **Step 3: Implement notification-queries.ts**

Create `src/lib/queries/notification-queries.ts`:

```typescript
import type Database from 'better-sqlite3';
import type { Notification, NotificationType, EmailDelivery, NotificationPreference } from '@/lib/types';

interface InsertNotificationInput {
  type: NotificationType;
  title: string;
  message: string | null;
  link: string | null;
}

const FORCED_IMMEDIATE: NotificationType[] = ['server_down', 'server_recovered', 'client_health_critical'];

const DEFAULT_PREFERENCES: Record<NotificationType, EmailDelivery> = {
  server_down: 'immediate',
  server_recovered: 'immediate',
  client_health_critical: 'immediate',
  invoice_overdue: 'digest',
  invoice_paid: 'digest',
  deliverable_overdue: 'digest',
  follow_up_due: 'digest',
  lead_stage_changed: 'digest',
  time_invoiced: 'none',
};

export { FORCED_IMMEDIATE, DEFAULT_PREFERENCES };

export function insertNotification(db: Database.Database, input: InsertNotificationInput): number {
  const result = db.prepare(`
    INSERT INTO notifications (type, title, message, link)
    VALUES (@type, @title, @message, @link)
  `).run({
    type: input.type,
    title: input.title,
    message: input.message,
    link: input.link,
  });
  return Number(result.lastInsertRowid);
}

export function getUnreadCount(db: Database.Database): number {
  return (db.prepare('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0').get() as any).count;
}

export function getRecentNotifications(db: Database.Database, limit: number): Notification[] {
  return db.prepare('SELECT * FROM notifications ORDER BY created_at DESC, id DESC LIMIT ?').all(limit) as Notification[];
}

export function getNotificationsFiltered(
  db: Database.Database,
  filters: { type?: string; isRead?: boolean; startDate?: string; endDate?: string }
): Notification[] {
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters.type) {
    conditions.push('type = ?');
    params.push(filters.type);
  }
  if (filters.isRead !== undefined) {
    conditions.push('is_read = ?');
    params.push(filters.isRead ? 1 : 0);
  }
  if (filters.startDate) {
    conditions.push('created_at >= ?');
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    conditions.push('created_at <= ?');
    params.push(filters.endDate + ' 23:59:59');
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return db.prepare(`SELECT * FROM notifications ${where} ORDER BY created_at DESC, id DESC`).all(...params) as Notification[];
}

export function markNotificationRead(db: Database.Database, id: number): void {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
}

export function markAllRead(db: Database.Database): void {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE is_read = 0').run();
}

export function getNotificationPreferences(db: Database.Database): (NotificationPreference & { forced: boolean })[] {
  const stored = db.prepare('SELECT * FROM notification_preferences').all() as NotificationPreference[];
  const storedMap = new Map(stored.map(p => [p.notification_type, p]));

  const allTypes = Object.keys(DEFAULT_PREFERENCES) as NotificationType[];
  return allTypes.map(type => {
    const existing = storedMap.get(type);
    const forced = FORCED_IMMEDIATE.includes(type);
    return {
      id: existing?.id ?? 0,
      notification_type: type,
      email_delivery: forced ? 'immediate' : (existing?.email_delivery ?? DEFAULT_PREFERENCES[type]),
      forced,
    };
  });
}

export function upsertPreference(db: Database.Database, type: NotificationType, delivery: EmailDelivery): void {
  db.prepare(`
    INSERT INTO notification_preferences (notification_type, email_delivery)
    VALUES (?, ?)
    ON CONFLICT(notification_type) DO UPDATE SET email_delivery = excluded.email_delivery
  `).run(type, delivery);
}

export function getEmailDeliveryForType(db: Database.Database, type: NotificationType): EmailDelivery {
  if (FORCED_IMMEDIATE.includes(type)) return 'immediate';
  const row = db.prepare('SELECT email_delivery FROM notification_preferences WHERE notification_type = ?').get(type) as any;
  return row?.email_delivery ?? DEFAULT_PREFERENCES[type];
}

export function getDigestNotifications(db: Database.Database): Notification[] {
  const digestTypes = Object.entries(DEFAULT_PREFERENCES)
    .filter(([type]) => !FORCED_IMMEDIATE.includes(type as NotificationType))
    .map(([type]) => type);

  // Get types with digest preference (or default digest)
  const prefs = db.prepare('SELECT notification_type, email_delivery FROM notification_preferences').all() as NotificationPreference[];
  const prefMap = new Map(prefs.map(p => [p.notification_type, p.email_delivery]));

  const includeTypes = digestTypes.filter(type => {
    const delivery = prefMap.get(type as NotificationType) ?? DEFAULT_PREFERENCES[type as NotificationType];
    return delivery === 'digest';
  });

  if (includeTypes.length === 0) return [];

  const placeholders = includeTypes.map(() => '?').join(',');
  return db.prepare(`
    SELECT * FROM notifications
    WHERE type IN (${placeholders})
      AND is_read = 0
      AND created_at >= datetime('now', '-24 hours')
    ORDER BY created_at DESC
  `).all(...includeTypes) as Notification[];
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/philipsmith/commandpost && npx vitest run tests/queries/notification-queries.test.ts`
Expected: All 8 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/notification-queries.ts tests/queries/notification-queries.test.ts
git commit -m "feat(notifications): add notification query functions with tests"
```

---

### Task 4: createNotification orchestrator

**Files:**
- Create: `src/lib/notifications.ts`
- Create: `tests/notifications.test.ts`

- [ ] **Step 1: Write tests**

Create `tests/notifications.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initDb } from '@/lib/db';
import { createNotification } from '@/lib/notifications';
import { getUnreadCount } from '@/lib/queries/notification-queries';
import type Database from 'better-sqlite3';

// Mock email module
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

let db: Database.Database;

beforeEach(() => {
  db = initDb(':memory:');
  vi.clearAllMocks();
});

describe('createNotification', () => {
  it('inserts notification into database', async () => {
    await createNotification(db, { type: 'invoice_paid', title: 'Invoice paid', message: '$500', link: '/finances/invoices/1' });
    expect(getUnreadCount(db)).toBe(1);
  });

  it('sends immediate email for forced types', async () => {
    const { sendEmail } = await import('@/lib/email');
    await createNotification(db, { type: 'server_down', title: 'Server down', message: 'api.example.com', link: '/ops/1' });
    expect(sendEmail).toHaveBeenCalled();
  });

  it('does not send email for digest types', async () => {
    const { sendEmail } = await import('@/lib/email');
    await createNotification(db, { type: 'invoice_paid', title: 'Paid', message: null, link: null });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('sends email when preference is immediate', async () => {
    const { sendEmail } = await import('@/lib/email');
    db.prepare("INSERT INTO notification_preferences (notification_type, email_delivery) VALUES ('invoice_paid', 'immediate')").run();
    await createNotification(db, { type: 'invoice_paid', title: 'Paid', message: null, link: null });
    expect(sendEmail).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/philipsmith/commandpost && npx vitest run tests/notifications.test.ts 2>&1 | tail -10`
Expected: FAIL — module not found

- [ ] **Step 3: Implement notifications.ts**

Create `src/lib/notifications.ts`:

```typescript
import type Database from 'better-sqlite3';
import type { NotificationType } from '@/lib/types';
import { insertNotification, getEmailDeliveryForType } from '@/lib/queries/notification-queries';
import { sendEmail } from '@/lib/email';
import { buildAlertEmail } from '@/lib/email-templates';

interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  message: string | null;
  link: string | null;
}

export async function createNotification(db: Database.Database, input: CreateNotificationInput): Promise<number> {
  const id = insertNotification(db, input);

  const delivery = getEmailDeliveryForType(db, input.type);

  if (delivery === 'immediate') {
    const to = process.env.NOTIFICATION_TO_EMAIL;
    if (to) {
      const html = buildAlertEmail(input.title, input.message, input.link);
      await sendEmail({ to, subject: `[CommandPost] ${input.title}`, html });
    }
  }

  return id;
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/philipsmith/commandpost && npx vitest run tests/notifications.test.ts`
Expected: All 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications.ts tests/notifications.test.ts
git commit -m "feat(notifications): add createNotification orchestrator with email dispatch"
```

---

### Task 5: Server actions for notifications

**Files:**
- Create: `src/lib/actions/notification-actions.ts`

- [ ] **Step 1: Create notification-actions.ts**

Create `src/lib/actions/notification-actions.ts`:

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { markNotificationRead, markAllRead, upsertPreference } from '@/lib/queries/notification-queries';
import type { NotificationType, EmailDelivery } from '@/lib/types';

export async function markNotificationReadAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  markNotificationRead(db, id);
  revalidatePath('/notifications');
}

export async function markAllNotificationsReadAction() {
  const db = getDb();
  markAllRead(db);
  revalidatePath('/notifications');
}

export async function updateNotificationPreferenceAction(formData: FormData) {
  const db = getDb();
  const type = formData.get('notification_type') as NotificationType;
  const delivery = formData.get('email_delivery') as EmailDelivery;
  upsertPreference(db, type, delivery);
  revalidatePath('/settings/notifications');
}
```

- [ ] **Step 2: Build to verify**

Run: `cd /Users/philipsmith/commandpost && npm run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/notification-actions.ts
git commit -m "feat(notifications): add server actions for notification management"
```

---

### Task 6: Notification Bell component + sidebar integration

**Files:**
- Create: `src/components/notification-bell.tsx`
- Modify: `src/components/sidebar.tsx`
- Modify: `src/components/mobile-nav.tsx`

- [ ] **Step 1: Create notification-bell.tsx**

Create `src/components/notification-bell.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { markNotificationReadAction, markAllNotificationsReadAction } from '@/lib/actions/notification-actions';
import type { Notification } from '@/lib/types';

interface NotificationBellProps {
  unreadCount: number;
  recentNotifications: Notification[];
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr + 'Z').getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function NotificationBell({ unreadCount, recentNotifications }: NotificationBellProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800"
        title="Notifications"
      >
        <span className="text-lg">&#x1F514;</span>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50">
          <div className="flex items-center justify-between p-3 border-b border-gray-800">
            <span className="text-sm font-medium text-white">Notifications</span>
            {unreadCount > 0 && (
              <form action={markAllNotificationsReadAction}>
                <button type="submit" className="text-xs text-blue-400 hover:text-blue-300">
                  Mark all read
                </button>
              </form>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {recentNotifications.length === 0 ? (
              <p className="p-4 text-sm text-gray-500 text-center">No notifications</p>
            ) : (
              recentNotifications.map((n) => (
                <div key={n.id} className="flex items-start gap-3 p-3 border-b border-gray-800/50 hover:bg-gray-800/50">
                  {!n.is_read && <span className="w-2 h-2 mt-1.5 rounded-full bg-blue-400 shrink-0" />}
                  {n.is_read && <span className="w-2 h-2 mt-1.5 rounded-full bg-transparent shrink-0" />}
                  <div className="flex-1 min-w-0">
                    {n.link ? (
                      <form action={markNotificationReadAction}>
                        <input type="hidden" name="id" value={n.id} />
                        <button type="submit" formAction={markNotificationReadAction} className="text-left w-full">
                          <Link href={n.link} className="text-sm text-white hover:text-blue-400 block truncate">
                            {n.title}
                          </Link>
                        </button>
                      </form>
                    ) : (
                      <p className="text-sm text-white truncate">{n.title}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-0.5">{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-2 border-t border-gray-800">
            <Link
              href="/notifications"
              className="block text-center text-xs text-blue-400 hover:text-blue-300 py-1"
              onClick={() => setOpen(false)}
            >
              View all
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update sidebar.tsx**

In `src/components/sidebar.tsx`, add the import at the top:

```typescript
import { getDb } from '@/lib/db';
import { getUnreadCount, getRecentNotifications } from '@/lib/queries/notification-queries';
import { NotificationBell } from '@/components/notification-bell';
```

Wait — the sidebar is a `'use client'` component and can't call DB directly. Instead, the bell needs to receive props from a server component. The simplest approach: add the bell to the layout that wraps the sidebar.

Actually, let's keep it simple — add a `NotificationBellServer` wrapper that fetches data and passes to the client component. Update the sidebar to include it.

Replace the approach: Create `src/components/notification-bell-server.tsx`:

```tsx
import { getDb } from '@/lib/db';
import { getUnreadCount, getRecentNotifications } from '@/lib/queries/notification-queries';
import { NotificationBell } from '@/components/notification-bell';

export function NotificationBellServer() {
  const db = getDb();
  const unreadCount = getUnreadCount(db);
  const recentNotifications = getRecentNotifications(db, 10);
  return <NotificationBell unreadCount={unreadCount} recentNotifications={recentNotifications} />;
}
```

Then in `src/components/sidebar.tsx`, since it's `'use client'`, we can't embed a server component directly. Instead, modify the **dashboard layout** to include the bell.

Read the layout file to determine where to put it.

Actually the simplest approach: add a `{ href: '/notifications', label: 'Alerts', icon: '🔔' }` nav item to sidebar + mobile-nav, and show the unread badge on the notifications page itself. The bell dropdown is a nice-to-have but adds complexity with the client/server boundary.

Let me simplify: Add "Notifications" to the nav items in both sidebar and mobile-nav. Show unread count via a server component in the layout header area.

Let me check the layout:

- [ ] **Step 2 (revised): Add Notifications nav item to sidebar**

In `src/components/sidebar.tsx`, add to the `navItems` array after the Reports entry:

```typescript
  { href: '/notifications', label: 'Notifications', icon: '⊛' },
```

- [ ] **Step 3: Add to mobile-nav.tsx**

In `src/components/mobile-nav.tsx`, add to the `navItems` array after the Reports entry:

```typescript
  { href: '/notifications', label: 'Alerts', icon: '⊛' },
```

- [ ] **Step 4: Add NotificationBellServer to the dashboard layout**

Read the layout file first. Create `src/components/notification-bell-server.tsx`:

```tsx
import { getDb } from '@/lib/db';
import { getUnreadCount, getRecentNotifications } from '@/lib/queries/notification-queries';
import { NotificationBell } from '@/components/notification-bell';

export function NotificationBellServer() {
  const db = getDb();
  const unreadCount = getUnreadCount(db);
  const recentNotifications = getRecentNotifications(db, 10);
  return <NotificationBell unreadCount={unreadCount} recentNotifications={recentNotifications} />;
}
```

Then add the `NotificationBellServer` component to the dashboard layout (in the header/top area). The implementer should read `src/app/(dashboard)/layout.tsx` to find the right insertion point �� typically next to any existing header content, at the top-right of the main content area.

- [ ] **Step 5: Build to verify**

Run: `cd /Users/philipsmith/commandpost && npm run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/components/notification-bell.tsx src/components/notification-bell-server.tsx src/components/sidebar.tsx src/components/mobile-nav.tsx
git commit -m "feat(notifications): add notification bell and sidebar nav item"
```

---

### Task 7: Notifications page

**Files:**
- Create: `src/app/(dashboard)/notifications/page.tsx`

- [ ] **Step 1: Create notifications page**

Create `src/app/(dashboard)/notifications/page.tsx`:

```tsx
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { getNotificationsFiltered, markAllRead } from '@/lib/queries/notification-queries';
import { markNotificationReadAction, markAllNotificationsReadAction } from '@/lib/actions/notification-actions';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; start?: string; end?: string }>;
}) {
  const sp = await searchParams;
  const db = getDb();

  const filters: { type?: string; isRead?: boolean; startDate?: string; endDate?: string } = {};
  if (sp.type) filters.type = sp.type;
  if (sp.status === 'read') filters.isRead = true;
  if (sp.status === 'unread') filters.isRead = false;
  if (sp.start) filters.startDate = sp.start;
  if (sp.end) filters.endDate = sp.end;

  const notifications = getNotificationsFiltered(db, filters);

  const typeLabels: Record<string, string> = {
    server_down: 'Server Down',
    server_recovered: 'Server Recovered',
    client_health_critical: 'Client Health',
    invoice_overdue: 'Invoice Overdue',
    invoice_paid: 'Invoice Paid',
    deliverable_overdue: 'Deliverable Overdue',
    follow_up_due: 'Follow-up Due',
    lead_stage_changed: 'Lead Stage',
    time_invoiced: 'Time Invoiced',
  };

  const typeColors: Record<string, string> = {
    server_down: 'bg-red-900/30 text-red-400',
    server_recovered: 'bg-green-900/30 text-green-400',
    client_health_critical: 'bg-red-900/30 text-red-400',
    invoice_overdue: 'bg-yellow-900/30 text-yellow-400',
    invoice_paid: 'bg-green-900/30 text-green-400',
    deliverable_overdue: 'bg-yellow-900/30 text-yellow-400',
    follow_up_due: 'bg-blue-900/30 text-blue-400',
    lead_stage_changed: 'bg-purple-900/30 text-purple-400',
    time_invoiced: 'bg-green-900/30 text-green-400',
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <div className="flex gap-2">
          <form action={markAllNotificationsReadAction}>
            <button type="submit" className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors">
              Mark all read
            </button>
          </form>
          <Link href="/settings/notifications" className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors">
            Settings
          </Link>
        </div>
      </div>

      {/* Filters */}
      <form className="flex flex-wrap gap-3 mb-6">
        <select name="type" defaultValue={sp.type || ''} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
          <option value="">All Types</option>
          {Object.entries(typeLabels).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select name="status" defaultValue={sp.status || ''} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
          <option value="">All</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </select>
        <input type="date" name="start" defaultValue={sp.start || ''} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
        <input type="date" name="end" defaultValue={sp.end || ''} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
        <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors">
          Filter
        </button>
      </form>

      {/* Notification List */}
      {notifications.length === 0 ? (
        <p className="text-gray-500 text-sm">No notifications found.</p>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div key={n.id} className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${n.is_read ? 'bg-gray-900/50 border-gray-800/50' : 'bg-gray-900 border-gray-800'}`}>
              {!n.is_read && <span className="w-2 h-2 mt-2 rounded-full bg-blue-400 shrink-0" />}
              {n.is_read && <span className="w-2 h-2 mt-2 rounded-full bg-transparent shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded ${typeColors[n.type] || 'bg-gray-800 text-gray-400'}`}>
                    {typeLabels[n.type] || n.type}
                  </span>
                  <span className="text-xs text-gray-500">{new Date(n.created_at + 'Z').toLocaleString()}</span>
                </div>
                {n.link ? (
                  <form action={markNotificationReadAction} className="inline">
                    <input type="hidden" name="id" value={n.id} />
                    <button type="submit" className="text-left">
                      <Link href={n.link} className="text-sm text-white hover:text-blue-400">
                        {n.title}
                      </Link>
                    </button>
                  </form>
                ) : (
                  <p className="text-sm text-white">{n.title}</p>
                )}
                {n.message && <p className="text-sm text-gray-400 mt-1">{n.message}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build to verify**

Run: `cd /Users/philipsmith/commandpost && npm run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/notifications/page.tsx"
git commit -m "feat(notifications): add notifications page with filters"
```

---

### Task 8: Notification preferences page

**Files:**
- Create: `src/app/(dashboard)/settings/notifications/page.tsx`

- [ ] **Step 1: Create settings page**

Create `src/app/(dashboard)/settings/notifications/page.tsx`:

```tsx
import { getDb } from '@/lib/db';
import { getNotificationPreferences } from '@/lib/queries/notification-queries';
import { updateNotificationPreferenceAction } from '@/lib/actions/notification-actions';

export const dynamic = 'force-dynamic';

export default function NotificationSettingsPage() {
  const db = getDb();
  const preferences = getNotificationPreferences(db);

  const typeLabels: Record<string, string> = {
    server_down: 'Server Down',
    server_recovered: 'Server Recovered',
    client_health_critical: 'Client Health Critical',
    invoice_overdue: 'Invoice Overdue',
    invoice_paid: 'Invoice Paid',
    deliverable_overdue: 'Deliverable Overdue',
    follow_up_due: 'Follow-up Due',
    lead_stage_changed: 'Lead Stage Changed',
    time_invoiced: 'Time Invoiced',
  };

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-bold mb-6">Notification Settings</h1>
      <p className="text-gray-400 text-sm mb-6">Configure how you receive email notifications for each event type.</p>

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-left">
              <th className="p-4">Event Type</th>
              <th className="p-4">Email Delivery</th>
            </tr>
          </thead>
          <tbody>
            {preferences.map((pref) => (
              <tr key={pref.notification_type} className="border-b border-gray-800/50">
                <td className="p-4 text-white">{typeLabels[pref.notification_type] || pref.notification_type}</td>
                <td className="p-4">
                  {pref.forced ? (
                    <span className="text-sm text-yellow-400">Immediate (required)</span>
                  ) : (
                    <form action={updateNotificationPreferenceAction} className="inline">
                      <input type="hidden" name="notification_type" value={pref.notification_type} />
                      <select
                        name="email_delivery"
                        defaultValue={pref.email_delivery}
                        onChange={(e) => (e.target.closest('form') as HTMLFormElement)?.requestSubmit()}
                        className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
                      >
                        <option value="immediate">Immediate</option>
                        <option value="digest">Daily Digest</option>
                        <option value="none">None</option>
                      </select>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build to verify**

Run: `cd /Users/philipsmith/commandpost && npm run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/settings/notifications/page.tsx"
git commit -m "feat(notifications): add notification preferences settings page"
```

---

### Task 9: Cron endpoints (event checker + digest)

**Files:**
- Create: `src/app/api/cron/notifications/route.ts`
- Create: `src/app/api/cron/digest/route.ts`

- [ ] **Step 1: Create notifications cron route**

Create `src/app/api/cron/notifications/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { createNotification } from '@/lib/notifications';
import { hasAlertBeenSentToday, hasAlertBeenSentInLastDays } from '@/lib/queries/alert-queries';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  let created = 0;

  // Overdue invoices
  const overdueInvoices = db.prepare(`
    SELECT i.id, i.invoice_number, i.total_amount, c.name as client_name
    FROM invoices i JOIN clients c ON i.client_id = c.id
    WHERE i.status = 'sent' AND i.due_date < date('now')
  `).all() as any[];

  for (const inv of overdueInvoices) {
    if (!hasAlertBeenSentToday(db, 'invoice_overdue' as any, inv.id)) {
      await createNotification(db, {
        type: 'invoice_overdue',
        title: `Invoice ${inv.invoice_number} overdue`,
        message: `${inv.client_name} — $${inv.total_amount}`,
        link: `/finances/invoices/${inv.id}`,
      });
      created++;
    }
  }

  // Overdue deliverables
  const overdueDeliverables = db.prepare(`
    SELECT d.id, d.title, p.id as project_id, p.name as project_name, c.id as client_id, c.name as client_name
    FROM deliverables d JOIN projects p ON d.project_id = p.id JOIN clients c ON p.client_id = c.id
    WHERE d.status != 'delivered' AND d.due_date < date('now') AND c.deleted_at IS NULL
  `).all() as any[];

  for (const d of overdueDeliverables) {
    if (!hasAlertBeenSentToday(db, 'deliverable_overdue' as any, d.id)) {
      await createNotification(db, {
        type: 'deliverable_overdue',
        title: `Deliverable overdue: ${d.title}`,
        message: `${d.client_name} / ${d.project_name}`,
        link: `/clients/${d.client_id}/projects/${d.project_id}`,
      });
      created++;
    }
  }

  // Follow-ups due
  const followUps = db.prepare(`
    SELECT id, business_name, contact_person, follow_up_date
    FROM leads WHERE stage NOT IN ('won','lost') AND follow_up_date <= date('now')
  `).all() as any[];

  for (const lead of followUps) {
    if (!hasAlertBeenSentToday(db, 'follow_up_due' as any, lead.id)) {
      await createNotification(db, {
        type: 'follow_up_due',
        title: `Follow up: ${lead.business_name}`,
        message: lead.contact_person ? `Contact: ${lead.contact_person}` : null,
        link: `/pipeline/${lead.id}`,
      });
      created++;
    }
  }

  // Client health critical
  const unhealthyClients = db.prepare(`
    SELECT c.id, c.name FROM clients c WHERE c.deleted_at IS NULL AND c.status = 'active'
  `).all() as any[];

  // Import client health check
  const { getClientHealthSummary } = await import('@/lib/queries/client-queries');
  const healthData = getClientHealthSummary(db);

  for (const h of healthData) {
    if (h.status === 'needs_attention') {
      if (!hasAlertBeenSentInLastDays(db, 'client_health_warning', h.clientId, 7)) {
        await createNotification(db, {
          type: 'client_health_critical',
          title: `${h.clientName} needs attention`,
          message: `Health score: ${h.score}/100`,
          link: `/clients/${h.clientId}`,
        });
        created++;
      }
    }
  }

  return NextResponse.json({ ok: true, created });
}
```

- [ ] **Step 2: Create digest cron route**

Create `src/app/api/cron/digest/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getDigestNotifications } from '@/lib/queries/notification-queries';
import { recordAlert } from '@/lib/queries/alert-queries';
import { sendEmail } from '@/lib/email';
import { buildDigestEmail } from '@/lib/email-templates';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const notifications = getDigestNotifications(db);

  if (notifications.length === 0) {
    return NextResponse.json({ ok: true, sent: false, reason: 'no items' });
  }

  const items = notifications.map(n => ({
    title: n.title,
    message: n.message,
    link: n.link,
    type: n.type,
  }));

  const html = buildDigestEmail(items);
  const to = process.env.NOTIFICATION_TO_EMAIL;

  if (!to) {
    return NextResponse.json({ ok: false, reason: 'NOTIFICATION_TO_EMAIL not set' });
  }

  const sent = await sendEmail({
    to,
    subject: `[CommandPost] Daily Digest — ${notifications.length} item${notifications.length === 1 ? '' : 's'}`,
    html,
  });

  if (sent) {
    recordAlert(db, {
      alert_type: 'morning_briefing',
      reference_id: null,
      message: `Daily digest sent with ${notifications.length} items`,
    });
  }

  return NextResponse.json({ ok: true, sent, items: notifications.length });
}
```

- [ ] **Step 3: Build to verify**

Run: `cd /Users/philipsmith/commandpost && npm run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/notifications/route.ts src/app/api/cron/digest/route.ts
git commit -m "feat(notifications): add cron endpoints for event checking and daily digest"
```

---

### Task 10: Integration — add notifications to existing actions

**Files:**
- Modify: `src/lib/actions/invoice-actions.ts`
- Modify: `src/lib/actions/lead-actions.ts`
- Modify: `src/lib/actions/time-actions.ts`

- [ ] **Step 1: Add notification to markInvoicePaidAction**

In `src/lib/actions/invoice-actions.ts`, add import at top:

```typescript
import { createNotification } from '@/lib/notifications';
import { getInvoiceById } from '@/lib/queries/invoice-queries';
```

In `markInvoicePaidAction`, after `markInvoicePaid(db, id);` add:

```typescript
  const invoice = getInvoiceById(db, id);
  if (invoice) {
    const clientName = (db.prepare('SELECT name FROM clients WHERE id = ?').get(invoice.client_id) as any)?.name || 'Unknown';
    await createNotification(db, {
      type: 'invoice_paid',
      title: `Invoice ${invoice.invoice_number} paid`,
      message: `${clientName} — $${invoice.total_amount}`,
      link: `/finances/invoices/${id}`,
    });
  }
```

- [ ] **Step 2: Add notification to updateLeadStageAction**

In `src/lib/actions/lead-actions.ts`, add import at top:

```typescript
import { createNotification } from '@/lib/notifications';
```

In `updateLeadStageAction`, after `updateLeadStage(db, id, stage);` add:

```typescript
  const lead = getLeadById(db, id);
  if (lead) {
    await createNotification(db, {
      type: 'lead_stage_changed',
      title: `${lead.business_name} moved to ${stage}`,
      message: lead.contact_person ? `Contact: ${lead.contact_person}` : null,
      link: `/pipeline/${id}`,
    });
  }
```

Note: `getLeadById` is already imported in this file.

- [ ] **Step 3: Add notification to generateInvoiceFromTimeAction**

In `src/lib/actions/time-actions.ts`, add import at top:

```typescript
import { createNotification } from '@/lib/notifications';
```

In `generateInvoiceFromTimeAction`, after the `markEntriesInvoiced` call and before `revalidatePath`, add:

```typescript
  const clientName = (db.prepare('SELECT name FROM clients WHERE id = ?').get(clientId) as any)?.name || 'Unknown';
  await createNotification(db, {
    type: 'time_invoiced',
    title: `Time entries invoiced for ${clientName}`,
    message: `${entries.length} entries — $${totalAmount.toFixed(2)}`,
    link: `/finances/invoices/${invoiceId}`,
  });
```

- [ ] **Step 4: Build to verify**

Run: `cd /Users/philipsmith/commandpost && npm run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 5: Run full test suite**

Run: `cd /Users/philipsmith/commandpost && npx vitest run 2>&1 | tail -15`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/actions/invoice-actions.ts src/lib/actions/lead-actions.ts src/lib/actions/time-actions.ts
git commit -m "feat(notifications): integrate notifications into invoice, lead, and time actions"
```

---

### Task 11: Update alert types and add bell to layout

**Files:**
- Modify: `src/lib/types.ts` (update AlertType)
- Modify: `src/app/(dashboard)/layout.tsx` (add bell server component)

- [ ] **Step 1: Update AlertType to include new notification types**

In `src/lib/types.ts`, update the `AlertType` to include the notification-related types used in `hasAlertBeenSentToday` calls:

```typescript
export type AlertType = 'server_down' | 'server_recovered' | 'morning_briefing' | 'disk_warning' | 'client_health_warning' | 'invoice_overdue' | 'deliverable_overdue' | 'follow_up_due';
```

- [ ] **Step 2: Add NotificationBellServer to dashboard layout**

Read `src/app/(dashboard)/layout.tsx` to find the right place. Add import:

```typescript
import { NotificationBellServer } from '@/components/notification-bell-server';
```

Add `<NotificationBellServer />` in the layout — typically in the top-right of the main content area or next to the sidebar header. The implementer should read the layout and place it appropriately (e.g., in a header bar above the `{children}` content area).

- [ ] **Step 3: Build to verify**

Run: `cd /Users/philipsmith/commandpost && npm run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts "src/app/(dashboard)/layout.tsx" "src/components/notification-bell-server.tsx"
git commit -m "feat(notifications): add bell to dashboard layout and update alert types"
```

---

### Task 12: Final verification

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `cd /Users/philipsmith/commandpost && npx vitest run 2>&1`
Expected: All tests pass

- [ ] **Step 2: Run production build**

Run: `cd /Users/philipsmith/commandpost && npm run build 2>&1 | tail -30`
Expected: Build succeeds with new routes: `/notifications`, `/settings/notifications`, `/api/cron/notifications`, `/api/cron/digest`

- [ ] **Step 3: Verify new routes in build output**

Check that these appear in the route list:
- `/notifications`
- `/settings/notifications`
- `/api/cron/notifications`
- `/api/cron/digest`
