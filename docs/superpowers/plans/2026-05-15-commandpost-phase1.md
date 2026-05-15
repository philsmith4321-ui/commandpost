# CommandPost Phase 1: Foundation + Clients & Projects

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the CommandPost app with auth, layout, SQLite database, full Clients & Projects CRUD, and an initial Dashboard showing client data.

**Architecture:** Next.js 15 App Router with server actions for mutations, better-sqlite3 for data, middleware-based auth with JWT cookies. Single-user password login.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, better-sqlite3, jose (JWT), bcrypt, vitest

---

## File Structure

```
commandpost/
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # Root layout (html/body shell)
│   │   ├── (auth)/
│   │   │   └── login/
│   │   │       └── page.tsx              # Login page
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx                # Sidebar + mobile nav wrapper
│   │   │   ├── page.tsx                  # Dashboard home (morning briefing)
│   │   │   ├── clients/
│   │   │   │   ├── page.tsx              # Clients list
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx          # New client form
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx          # Client detail
│   │   │   │       ├── edit/
│   │   │   │       │   └── page.tsx      # Edit client form
│   │   │   │       └── projects/
│   │   │   │           ├── new/
│   │   │   │           │   └── page.tsx  # New project form
│   │   │   │           └── [projectId]/
│   │   │   │               ├── page.tsx  # Project detail
│   │   │   │               └── edit/
│   │   │   │                   └── page.tsx # Edit project form
│   │   │   └── api/
│   │   │       └── dashboard/
│   │   │           └── route.ts          # Dashboard data endpoint
│   ├── lib/
│   │   ├── db.ts                         # DB connection + schema init
│   │   ├── auth.ts                       # Password verify, JWT sign/verify
│   │   ├── types.ts                      # Shared TypeScript types
│   │   ├── actions/
│   │   │   ├── auth-actions.ts           # Login server action
│   │   │   ├── client-actions.ts         # Client CRUD server actions
│   │   │   ├── project-actions.ts        # Project CRUD server actions
│   │   │   ├── deliverable-actions.ts    # Deliverable CRUD server actions
│   │   │   └── activity-actions.ts       # Activity log server actions
│   │   └── queries/
│   │       ├── client-queries.ts         # Client read queries
│   │       ├── project-queries.ts        # Project read queries
│   │       └── dashboard-queries.ts      # Dashboard aggregate queries
│   ├── components/
│   │   ├── sidebar.tsx                   # Desktop sidebar nav
│   │   ├── mobile-nav.tsx                # Mobile bottom nav
│   │   ├── alert-bar.tsx                 # Critical alerts banner
│   │   ├── client-form.tsx               # Reusable client form
│   │   ├── project-form.tsx              # Reusable project form
│   │   ├── deliverable-list.tsx          # Deliverable checklist component
│   │   ├── activity-log.tsx              # Activity log component
│   │   └── status-badge.tsx              # Reusable status badge
│   └── middleware.ts                     # Auth check on protected routes
├── tests/
│   ├── lib/
│   │   ├── db.test.ts
│   │   └── auth.test.ts
│   ├── actions/
│   │   ├── client-actions.test.ts
│   │   ├── project-actions.test.ts
│   │   └── deliverable-actions.test.ts
│   └── queries/
│       └── dashboard-queries.test.ts
├── data/                                 # SQLite DB file (gitignored)
├── .env.local                            # Secrets (gitignored)
├── .env.example                          # Template for env vars
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
├── vitest.config.ts
└── .gitignore
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `.gitignore`, `.env.example`, `.env.local`, `vitest.config.ts`, `src/app/layout.tsx`, `src/app/(dashboard)/page.tsx`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd /Users/philipsmith/commandpost
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
```

- [ ] **Step 2: Install dependencies**

```bash
cd /Users/philipsmith/commandpost
npm install better-sqlite3 jose bcryptjs
npm install -D @types/better-sqlite3 @types/bcryptjs vitest @vitejs/plugin-react
```

- [ ] **Step 3: Create vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 4: Add test script to package.json**

Add to `scripts` in `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Create .env.example and .env.local**

Create `.env.example`:

```
ADMIN_PASSWORD_HASH=
JWT_SECRET=
```

Create `.env.local`:

```
ADMIN_PASSWORD_HASH=$2a$10$examplehashhere
JWT_SECRET=replace-with-random-64-char-string
```

Generate real values:

```bash
cd /Users/philipsmith/commandpost
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('changeme', 10));"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'));"
```

Replace the placeholder values in `.env.local` with the generated output.

- [ ] **Step 6: Update .gitignore**

Append to `.gitignore`:

```
data/
.env.local
```

- [ ] **Step 7: Create data directory with .gitkeep**

```bash
mkdir -p /Users/philipsmith/commandpost/data
touch /Users/philipsmith/commandpost/data/.gitkeep
```

- [ ] **Step 8: Verify project runs**

```bash
cd /Users/philipsmith/commandpost && npm run dev
```

Expected: Next.js dev server starts on http://localhost:3000 with default page.

- [ ] **Step 9: Commit**

```bash
cd /Users/philipsmith/commandpost
git add -A
git commit -m "feat: scaffold Next.js project with dependencies"
```

---

### Task 2: Database Setup

**Files:**
- Create: `src/lib/db.ts`, `src/lib/types.ts`, `tests/lib/db.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/db.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// We test initDb by calling it on a temp database
const TEST_DB_PATH = path.join(__dirname, '../../data/test.db');

describe('initDb', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('creates all required tables', async () => {
    const { initDb } = await import('@/lib/db');
    const db = initDb(TEST_DB_PATH);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r: any) => r.name);

    expect(tables).toContain('clients');
    expect(tables).toContain('projects');
    expect(tables).toContain('deliverables');
    expect(tables).toContain('activity_logs');

    db.close();
  });

  it('enables WAL mode', async () => {
    const { initDb } = await import('@/lib/db');
    const db = initDb(TEST_DB_PATH);

    const mode = db.pragma('journal_mode', { simple: true });
    expect(mode).toBe('wal');

    db.close();
  });

  it('enables foreign keys', async () => {
    const { initDb } = await import('@/lib/db');
    const db = initDb(TEST_DB_PATH);

    const fk = db.pragma('foreign_keys', { simple: true });
    expect(fk).toBe(1);

    db.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/philipsmith/commandpost && npx vitest run tests/lib/db.test.ts
```

Expected: FAIL — module `@/lib/db` not found.

- [ ] **Step 3: Create TypeScript types**

Create `src/lib/types.ts`:

```typescript
export type ClientStatus = 'active' | 'paused' | 'completed';
export type ProjectStatus = 'active' | 'on-hold' | 'completed';
export type DeliverableStatus = 'not_started' | 'in_progress' | 'delivered';
export type LeadStage = 'new' | 'contacted' | 'discovery' | 'proposal' | 'negotiating' | 'won' | 'lost';
export type LeadSource = 'referral' | 'website' | 'outbound' | 'other';
export type ExpenseCategory = 'servers' | 'software' | 'contractor' | 'marketing' | 'other';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';

export interface Client {
  id: number;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  source: string | null;
  status: ClientStatus;
  monthly_value: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Project {
  id: number;
  client_id: number;
  name: string;
  status: ProjectStatus;
  start_date: string | null;
  server_ip: string | null;
  repo_url: string | null;
  deploy_command: string | null;
  stack_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Deliverable {
  id: number;
  project_id: number;
  title: string;
  status: DeliverableStatus;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: number;
  client_id: number;
  project_id: number | null;
  content: string;
  created_at: string;
}
```

- [ ] **Step 4: Implement database initialization**

Create `src/lib/db.ts`:

```typescript
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'commandpost.db');

let _db: Database.Database | null = null;

export function initDb(dbPath: string = DB_PATH): Database.Database {
  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('cache_size = -64000');
  db.pragma('synchronous = NORMAL');
  db.pragma('temp_store = MEMORY');

  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_person TEXT,
      email TEXT,
      phone TEXT,
      notes TEXT,
      source TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','completed')),
      monthly_value REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','on-hold','completed')),
      start_date TEXT,
      server_ip TEXT,
      repo_url TEXT,
      deploy_command TEXT,
      stack_notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deliverables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started' CHECK(status IN ('not_started','in_progress','delivered')),
      due_date TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  return db;
}

export function getDb(): Database.Database {
  if (!_db) {
    _db = initDb();
  }
  return _db;
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd /Users/philipsmith/commandpost && npx vitest run tests/lib/db.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/philipsmith/commandpost
git add src/lib/db.ts src/lib/types.ts tests/lib/db.test.ts
git commit -m "feat: add SQLite database setup with schema and types"
```

---

### Task 3: Authentication

**Files:**
- Create: `src/lib/auth.ts`, `src/middleware.ts`, `src/app/(auth)/login/page.tsx`, `src/lib/actions/auth-actions.ts`, `tests/lib/auth.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/auth.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('auth', () => {
  it('verifyPassword returns true for correct password', async () => {
    const { verifyPassword, hashPassword } = await import('@/lib/auth');
    const hash = hashPassword('testpass123');
    const result = verifyPassword('testpass123', hash);
    expect(result).toBe(true);
  });

  it('verifyPassword returns false for wrong password', async () => {
    const { verifyPassword, hashPassword } = await import('@/lib/auth');
    const hash = hashPassword('testpass123');
    const result = verifyPassword('wrongpass', hash);
    expect(result).toBe(false);
  });

  it('createToken returns a JWT string', async () => {
    process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-testing-purposes-1234';
    const { createToken } = await import('@/lib/auth');
    const token = await createToken();
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  it('verifyToken validates a token created by createToken', async () => {
    process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-testing-purposes-1234';
    const { createToken, verifyToken } = await import('@/lib/auth');
    const token = await createToken();
    const payload = await verifyToken(token);
    expect(payload).toBeTruthy();
    expect(payload?.role).toBe('admin');
  });

  it('verifyToken returns null for invalid token', async () => {
    process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-testing-purposes-1234';
    const { verifyToken } = await import('@/lib/auth');
    const payload = await verifyToken('invalid.token.here');
    expect(payload).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/philipsmith/commandpost && npx vitest run tests/lib/auth.test.ts
```

Expected: FAIL — module `@/lib/auth` not found.

- [ ] **Step 3: Implement auth helpers**

Create `src/lib/auth.ts`:

```typescript
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

const SALT_ROUNDS = 10;

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');
  return new TextEncoder().encode(secret);
}

export async function createToken(): Promise<string> {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getJwtSecret());
}

export async function verifyToken(token: string): Promise<{ role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as { role: string };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/philipsmith/commandpost && npx vitest run tests/lib/auth.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Create middleware**

Create `src/middleware.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!login|_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 6: Create login server action**

Create `src/lib/actions/auth-actions.ts`:

```typescript
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyPassword, createToken } from '@/lib/auth';

export async function loginAction(formData: FormData) {
  const password = formData.get('password') as string;
  const hash = process.env.ADMIN_PASSWORD_HASH;

  if (!hash || !password) {
    return { error: 'Invalid credentials' };
  }

  if (!verifyPassword(password, hash)) {
    return { error: 'Invalid credentials' };
  }

  const token = await createToken();
  const cookieStore = await cookies();
  cookieStore.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });

  redirect('/');
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete('auth_token');
  redirect('/login');
}
```

- [ ] **Step 7: Create login page**

Create `src/app/(auth)/login/page.tsx`:

```tsx
'use client';

import { useActionState } from 'react';
import { loginAction } from '@/lib/actions/auth-actions';

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(
    async (_prev: { error: string } | null, formData: FormData) => {
      return await loginAction(formData);
    },
    null
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm p-8 bg-gray-900 rounded-xl border border-gray-800">
        <h1 className="text-2xl font-bold text-white mb-2">CommandPost</h1>
        <p className="text-gray-400 mb-6 text-sm">Sign in to your command center</p>

        <form action={formAction}>
          <input
            type="password"
            name="password"
            placeholder="Password"
            required
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 mb-4"
          />

          {state?.error && (
            <p className="text-red-400 text-sm mb-4">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-medium rounded-lg transition-colors"
          >
            {pending ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Verify login flow manually**

```bash
cd /Users/philipsmith/commandpost && npm run dev
```

Visit http://localhost:3000 — should redirect to /login. Enter the password set in `.env.local`. Should redirect to `/`.

- [ ] **Step 9: Commit**

```bash
cd /Users/philipsmith/commandpost
git add src/lib/auth.ts src/middleware.ts src/lib/actions/auth-actions.ts "src/app/(auth)/login/page.tsx" tests/lib/auth.test.ts
git commit -m "feat: add single-user password auth with JWT cookies"
```

---

### Task 4: App Layout (Sidebar + Mobile Nav)

**Files:**
- Create: `src/components/sidebar.tsx`, `src/components/mobile-nav.tsx`, `src/app/(dashboard)/layout.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Update root layout with dark theme and font**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CommandPost',
  description: 'Business command center',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gray-950 text-white`}>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Create sidebar component**

Create `src/components/sidebar.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAction } from '@/lib/actions/auth-actions';

const navItems = [
  { href: '/', label: 'Dashboard', icon: '▣' },
  { href: '/clients', label: 'Clients', icon: '◉' },
  { href: '/pipeline', label: 'Pipeline', icon: '◈' },
  { href: '/finances', label: 'Finances', icon: '◇' },
  { href: '/ops', label: 'Ops', icon: '◆' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-56 bg-gray-900 border-r border-gray-800 min-h-screen">
      <div className="p-5 border-b border-gray-800">
        <h1 className="text-lg font-bold text-white">CommandPost</h1>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-gray-800">
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg text-left transition-colors"
          >
            Sign Out
          </button>
        </form>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Create mobile nav component**

Create `src/components/mobile-nav.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Home', icon: '▣' },
  { href: '/clients', label: 'Clients', icon: '◉' },
  { href: '/pipeline', label: 'Pipeline', icon: '◈' },
  { href: '/finances', label: 'Finances', icon: '◇' },
  { href: '/ops', label: 'Ops', icon: '◆' },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 z-50">
      <div className="flex justify-around py-2">
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 text-xs ${
                isActive ? 'text-blue-400' : 'text-gray-500'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 4: Create dashboard layout wrapper**

Create `src/app/(dashboard)/layout.tsx`:

```tsx
import { Sidebar } from '@/components/sidebar';
import { MobileNav } from '@/components/mobile-nav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 pb-16 md:pb-0">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
```

- [ ] **Step 5: Create placeholder dashboard page**

Replace `src/app/(dashboard)/page.tsx`:

```tsx
export default function DashboardPage() {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-2">Good morning</h2>
      <p className="text-gray-400">Your command center is ready.</p>
    </div>
  );
}
```

- [ ] **Step 6: Verify layout renders**

```bash
cd /Users/philipsmith/commandpost && npm run dev
```

Visit http://localhost:3000. After login, should see sidebar on desktop, bottom nav on mobile, and the placeholder dashboard.

- [ ] **Step 7: Commit**

```bash
cd /Users/philipsmith/commandpost
git add src/components/sidebar.tsx src/components/mobile-nav.tsx "src/app/(dashboard)/layout.tsx" "src/app/(dashboard)/page.tsx" src/app/layout.tsx
git commit -m "feat: add sidebar navigation and mobile bottom nav layout"
```

---

### Task 5: Client CRUD — Queries & Actions

**Files:**
- Create: `src/lib/queries/client-queries.ts`, `src/lib/actions/client-actions.ts`, `tests/actions/client-actions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/actions/client-actions.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initDb } from '@/lib/db';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-clients.db');

describe('client queries', () => {
  let db: Database.Database;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    db = initDb(TEST_DB_PATH);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('creates and retrieves a client', async () => {
    const { createClient, getClientById } = await import('@/lib/queries/client-queries');

    const id = createClient(db, {
      name: 'Paul Winkler Inc',
      contact_person: 'Paul Winkler',
      email: 'paul@test.com',
      phone: '555-0100',
      notes: 'Financial advisor',
      source: 'referral',
      status: 'active',
      monthly_value: 3000,
    });

    expect(id).toBeGreaterThan(0);

    const client = getClientById(db, id);
    expect(client).toBeTruthy();
    expect(client!.name).toBe('Paul Winkler Inc');
    expect(client!.monthly_value).toBe(3000);
    expect(client!.status).toBe('active');
  });

  it('lists all non-deleted clients', async () => {
    const { createClient, listClients } = await import('@/lib/queries/client-queries');

    createClient(db, { name: 'Client A', status: 'active' });
    createClient(db, { name: 'Client B', status: 'active' });

    const clients = listClients(db);
    expect(clients).toHaveLength(2);
  });

  it('updates a client', async () => {
    const { createClient, updateClient, getClientById } = await import('@/lib/queries/client-queries');

    const id = createClient(db, { name: 'Old Name', status: 'active' });
    updateClient(db, id, { name: 'New Name', monthly_value: 5000 });

    const client = getClientById(db, id);
    expect(client!.name).toBe('New Name');
    expect(client!.monthly_value).toBe(5000);
  });

  it('soft-deletes a client', async () => {
    const { createClient, softDeleteClient, listClients, getClientById } = await import('@/lib/queries/client-queries');

    const id = createClient(db, { name: 'To Delete', status: 'active' });
    softDeleteClient(db, id);

    const clients = listClients(db);
    expect(clients).toHaveLength(0);

    const client = getClientById(db, id);
    expect(client!.deleted_at).toBeTruthy();
  });

  it('filters clients by status', async () => {
    const { createClient, listClients } = await import('@/lib/queries/client-queries');

    createClient(db, { name: 'Active', status: 'active' });
    createClient(db, { name: 'Completed', status: 'completed' });

    const active = listClients(db, { status: 'active' });
    expect(active).toHaveLength(1);
    expect(active[0].name).toBe('Active');
  });

  it('cascades completion to projects when client marked completed', async () => {
    const { createClient, updateClient } = await import('@/lib/queries/client-queries');

    const clientId = createClient(db, { name: 'Test Client', status: 'active' });

    db.prepare('INSERT INTO projects (client_id, name, status) VALUES (?, ?, ?)').run(clientId, 'Project A', 'active');

    updateClient(db, clientId, { status: 'completed' });

    const project = db.prepare('SELECT status FROM projects WHERE client_id = ?').get(clientId) as any;
    expect(project.status).toBe('completed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/philipsmith/commandpost && npx vitest run tests/actions/client-actions.test.ts
```

Expected: FAIL — module `@/lib/queries/client-queries` not found.

- [ ] **Step 3: Implement client queries**

Create `src/lib/queries/client-queries.ts`:

```typescript
import type Database from 'better-sqlite3';
import type { Client, ClientStatus } from '@/lib/types';

interface CreateClientInput {
  name: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  source?: string | null;
  status: ClientStatus;
  monthly_value?: number | null;
}

interface UpdateClientInput {
  name?: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  source?: string | null;
  status?: ClientStatus;
  monthly_value?: number | null;
}

interface ListClientsFilter {
  status?: ClientStatus;
  search?: string;
}

export function createClient(db: Database.Database, input: CreateClientInput): number {
  const stmt = db.prepare(`
    INSERT INTO clients (name, contact_person, email, phone, notes, source, status, monthly_value)
    VALUES (@name, @contact_person, @email, @phone, @notes, @source, @status, @monthly_value)
  `);

  const result = stmt.run({
    name: input.name,
    contact_person: input.contact_person ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    notes: input.notes ?? null,
    source: input.source ?? null,
    status: input.status,
    monthly_value: input.monthly_value ?? null,
  });

  return Number(result.lastInsertRowid);
}

export function getClientById(db: Database.Database, id: number): Client | undefined {
  return db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as Client | undefined;
}

export function listClients(db: Database.Database, filter?: ListClientsFilter): Client[] {
  let sql = 'SELECT * FROM clients WHERE deleted_at IS NULL';
  const params: any[] = [];

  if (filter?.status) {
    sql += ' AND status = ?';
    params.push(filter.status);
  }

  if (filter?.search) {
    sql += ' AND (name LIKE ? OR contact_person LIKE ?)';
    params.push(`%${filter.search}%`, `%${filter.search}%`);
  }

  sql += ' ORDER BY updated_at DESC';

  return db.prepare(sql).all(...params) as Client[];
}

export function updateClient(db: Database.Database, id: number, input: UpdateClientInput): void {
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

  db.prepare(`UPDATE clients SET ${fields.join(', ')} WHERE id = @id`).run(params);

  // Cascade: if status changed to completed, complete all active projects
  if (input.status === 'completed') {
    db.prepare(
      "UPDATE projects SET status = 'completed', updated_at = datetime('now') WHERE client_id = ? AND status = 'active'"
    ).run(id);
  }
}

export function softDeleteClient(db: Database.Database, id: number): void {
  db.prepare("UPDATE clients SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(id);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/philipsmith/commandpost && npx vitest run tests/actions/client-actions.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Create client server actions**

Create `src/lib/actions/client-actions.ts`:

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import {
  createClient,
  updateClient,
  softDeleteClient,
} from '@/lib/queries/client-queries';
import type { ClientStatus } from '@/lib/types';

export async function createClientAction(formData: FormData) {
  const db = getDb();
  const id = createClient(db, {
    name: formData.get('name') as string,
    contact_person: (formData.get('contact_person') as string) || null,
    email: (formData.get('email') as string) || null,
    phone: (formData.get('phone') as string) || null,
    notes: (formData.get('notes') as string) || null,
    source: (formData.get('source') as string) || null,
    status: (formData.get('status') as ClientStatus) || 'active',
    monthly_value: formData.get('monthly_value')
      ? Number(formData.get('monthly_value'))
      : null,
  });

  revalidatePath('/clients');
  redirect(`/clients/${id}`);
}

export async function updateClientAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));

  updateClient(db, id, {
    name: formData.get('name') as string,
    contact_person: (formData.get('contact_person') as string) || null,
    email: (formData.get('email') as string) || null,
    phone: (formData.get('phone') as string) || null,
    notes: (formData.get('notes') as string) || null,
    source: (formData.get('source') as string) || null,
    status: (formData.get('status') as ClientStatus) || 'active',
    monthly_value: formData.get('monthly_value')
      ? Number(formData.get('monthly_value'))
      : null,
  });

  revalidatePath('/clients');
  revalidatePath(`/clients/${id}`);
  redirect(`/clients/${id}`);
}

export async function deleteClientAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  softDeleteClient(db, id);
  revalidatePath('/clients');
  redirect('/clients');
}
```

- [ ] **Step 6: Commit**

```bash
cd /Users/philipsmith/commandpost
git add src/lib/queries/client-queries.ts src/lib/actions/client-actions.ts tests/actions/client-actions.test.ts
git commit -m "feat: add client CRUD queries and server actions"
```

---

### Task 6: Client UI Pages

**Files:**
- Create: `src/components/status-badge.tsx`, `src/components/client-form.tsx`, `src/app/(dashboard)/clients/page.tsx`, `src/app/(dashboard)/clients/new/page.tsx`, `src/app/(dashboard)/clients/[id]/page.tsx`, `src/app/(dashboard)/clients/[id]/edit/page.tsx`

- [ ] **Step 1: Create status badge component**

Create `src/components/status-badge.tsx`:

```tsx
const colors: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400',
  paused: 'bg-yellow-500/20 text-yellow-400',
  completed: 'bg-gray-500/20 text-gray-400',
  'on-hold': 'bg-yellow-500/20 text-yellow-400',
  not_started: 'bg-gray-500/20 text-gray-400',
  in_progress: 'bg-blue-500/20 text-blue-400',
  delivered: 'bg-green-500/20 text-green-400',
};

export function StatusBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, ' ').replace(/-/g, ' ');
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
        colors[status] || 'bg-gray-500/20 text-gray-400'
      }`}
    >
      {label}
    </span>
  );
}
```

- [ ] **Step 2: Create reusable client form component**

Create `src/components/client-form.tsx`:

```tsx
import type { Client } from '@/lib/types';

interface ClientFormProps {
  action: (formData: FormData) => void;
  client?: Client;
  submitLabel: string;
}

export function ClientForm({ action, client, submitLabel }: ClientFormProps) {
  return (
    <form action={action} className="space-y-4 max-w-lg">
      {client && <input type="hidden" name="id" value={client.id} />}

      <div>
        <label className="block text-sm text-gray-400 mb-1">Company / Client Name *</label>
        <input
          type="text"
          name="name"
          required
          defaultValue={client?.name}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Contact Person</label>
        <input
          type="text"
          name="contact_person"
          defaultValue={client?.contact_person ?? ''}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Email</label>
          <input
            type="email"
            name="email"
            defaultValue={client?.email ?? ''}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Phone</label>
          <input
            type="tel"
            name="phone"
            defaultValue={client?.phone ?? ''}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Status</label>
          <select
            name="status"
            defaultValue={client?.status ?? 'active'}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
          >
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Monthly Value ($)</label>
          <input
            type="number"
            name="monthly_value"
            step="0.01"
            defaultValue={client?.monthly_value ?? ''}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Source</label>
        <input
          type="text"
          name="source"
          placeholder="e.g., referral, website, cold outreach"
          defaultValue={client?.source ?? ''}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Notes</label>
        <textarea
          name="notes"
          rows={3}
          defaultValue={client?.notes ?? ''}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
        />
      </div>

      <button
        type="submit"
        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
      >
        {submitLabel}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Create clients list page**

Create `src/app/(dashboard)/clients/page.tsx`:

```tsx
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { listClients } from '@/lib/queries/client-queries';
import { StatusBadge } from '@/components/status-badge';

export default function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  return <ClientsContent searchParams={searchParams} />;
}

async function ClientsContent({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  const params = await searchParams;
  const db = getDb();
  const clients = listClients(db, {
    status: params.status as any,
    search: params.search,
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Clients</h2>
        <Link
          href="/clients/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + New Client
        </Link>
      </div>

      <div className="flex gap-2 mb-6">
        {['all', 'active', 'paused', 'completed'].map((s) => (
          <Link
            key={s}
            href={s === 'all' ? '/clients' : `/clients?status=${s}`}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              (s === 'all' && !params.status) || params.status === s
                ? 'bg-blue-600/20 text-blue-400'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Link>
        ))}
      </div>

      {clients.length === 0 ? (
        <p className="text-gray-500">No clients yet. Add your first client to get started.</p>
      ) : (
        <div className="space-y-2">
          {clients.map((client) => (
            <Link
              key={client.id}
              href={`/clients/${client.id}`}
              className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors"
            >
              <div>
                <h3 className="font-medium text-white">{client.name}</h3>
                {client.contact_person && (
                  <p className="text-sm text-gray-400">{client.contact_person}</p>
                )}
              </div>
              <div className="flex items-center gap-4">
                {client.monthly_value && (
                  <span className="text-sm text-gray-400">
                    ${client.monthly_value.toLocaleString()}/mo
                  </span>
                )}
                <StatusBadge status={client.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create new client page**

Create `src/app/(dashboard)/clients/new/page.tsx`:

```tsx
import Link from 'next/link';
import { ClientForm } from '@/components/client-form';
import { createClientAction } from '@/lib/actions/client-actions';

export default function NewClientPage() {
  return (
    <div className="p-6">
      <Link href="/clients" className="text-sm text-gray-400 hover:text-white mb-4 inline-block">
        &larr; Back to Clients
      </Link>
      <h2 className="text-2xl font-bold mb-6">New Client</h2>
      <ClientForm action={createClientAction} submitLabel="Create Client" />
    </div>
  );
}
```

- [ ] **Step 5: Create client detail page**

Create `src/app/(dashboard)/clients/[id]/page.tsx`:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getClientById } from '@/lib/queries/client-queries';
import { deleteClientAction } from '@/lib/actions/client-actions';
import { StatusBadge } from '@/components/status-badge';
import { ActivityLog } from '@/components/activity-log';
import { ProjectsList } from '@/components/projects-list';

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const client = getClientById(db, Number(id));

  if (!client) notFound();

  const projects = db
    .prepare('SELECT * FROM projects WHERE client_id = ? ORDER BY created_at DESC')
    .all(Number(id)) as any[];

  const activities = db
    .prepare('SELECT * FROM activity_logs WHERE client_id = ? ORDER BY created_at DESC LIMIT 50')
    .all(Number(id)) as any[];

  return (
    <div className="p-6">
      <Link href="/clients" className="text-sm text-gray-400 hover:text-white mb-4 inline-block">
        &larr; Back to Clients
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">{client.name}</h2>
          {client.contact_person && (
            <p className="text-gray-400">{client.contact_person}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={client.status} />
          <Link
            href={`/clients/${client.id}/edit`}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg hover:border-gray-600 transition-colors"
          >
            Edit
          </Link>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Email</p>
          <p className="text-sm text-white">{client.email || '—'}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Phone</p>
          <p className="text-sm text-white">{client.phone || '—'}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Monthly Value</p>
          <p className="text-sm text-white">
            {client.monthly_value ? `$${client.monthly_value.toLocaleString()}` : '—'}
          </p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Source</p>
          <p className="text-sm text-white">{client.source || '—'}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg md:col-span-2">
          <p className="text-xs text-gray-500 uppercase mb-1">Notes</p>
          <p className="text-sm text-white whitespace-pre-wrap">{client.notes || '—'}</p>
        </div>
      </div>

      {/* Projects */}
      <ProjectsList clientId={client.id} projects={projects} />

      {/* Activity Log */}
      <ActivityLog clientId={client.id} activities={activities} />

      {/* Danger Zone */}
      <div className="mt-12 pt-6 border-t border-gray-800">
        <form action={deleteClientAction}>
          <input type="hidden" name="id" value={client.id} />
          <button
            type="submit"
            className="px-4 py-2 text-sm text-red-400 border border-red-900 rounded-lg hover:bg-red-900/20 transition-colors"
            onClick={(e) => {
              if (!confirm('Delete this client? This cannot be undone.')) {
                e.preventDefault();
              }
            }}
          >
            Delete Client
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create edit client page**

Create `src/app/(dashboard)/clients/[id]/edit/page.tsx`:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getClientById } from '@/lib/queries/client-queries';
import { ClientForm } from '@/components/client-form';
import { updateClientAction } from '@/lib/actions/client-actions';

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const client = getClientById(db, Number(id));

  if (!client) notFound();

  return (
    <div className="p-6">
      <Link
        href={`/clients/${id}`}
        className="text-sm text-gray-400 hover:text-white mb-4 inline-block"
      >
        &larr; Back to {client.name}
      </Link>
      <h2 className="text-2xl font-bold mb-6">Edit Client</h2>
      <ClientForm action={updateClientAction} client={client} submitLabel="Save Changes" />
    </div>
  );
}
```

- [ ] **Step 7: Create projects list component (used on client detail)**

Create `src/components/projects-list.tsx`:

```tsx
import Link from 'next/link';
import { StatusBadge } from '@/components/status-badge';
import type { Project } from '@/lib/types';

interface ProjectsListProps {
  clientId: number;
  projects: Project[];
}

export function ProjectsList({ clientId, projects }: ProjectsListProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Projects</h3>
        <Link
          href={`/clients/${clientId}/projects/new`}
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          + Add Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <p className="text-sm text-gray-500">No projects yet.</p>
      ) : (
        <div className="space-y-2">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/clients/${clientId}/projects/${project.id}`}
              className="flex items-center justify-between p-3 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors"
            >
              <span className="text-sm font-medium text-white">{project.name}</span>
              <StatusBadge status={project.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Create activity log component**

Create `src/components/activity-log.tsx`:

```tsx
'use client';

import { useRef } from 'react';
import { addActivityAction } from '@/lib/actions/activity-actions';
import type { ActivityLog as ActivityLogType } from '@/lib/types';

interface ActivityLogProps {
  clientId: number;
  projectId?: number;
  activities: ActivityLogType[];
}

export function ActivityLog({ clientId, projectId, activities }: ActivityLogProps) {
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    await addActivityAction(formData);
    formRef.current?.reset();
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Activity Log</h3>

      <form ref={formRef} action={handleSubmit} className="mb-4 flex gap-2">
        <input type="hidden" name="client_id" value={clientId} />
        {projectId && <input type="hidden" name="project_id" value={projectId} />}
        <input
          type="text"
          name="content"
          required
          placeholder="Add a note — call, email, decision..."
          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Add
        </button>
      </form>

      {activities.length === 0 ? (
        <p className="text-sm text-gray-500">No activity yet.</p>
      ) : (
        <div className="space-y-2">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex gap-3 p-3 bg-gray-900 border border-gray-800 rounded-lg"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-gray-600 mt-2 shrink-0" />
              <div>
                <p className="text-sm text-white">{activity.content}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(activity.created_at + 'Z').toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
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

- [ ] **Step 9: Create activity log server action**

Create `src/lib/actions/activity-actions.ts`:

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';

export async function addActivityAction(formData: FormData) {
  const db = getDb();
  const clientId = Number(formData.get('client_id'));
  const projectId = formData.get('project_id')
    ? Number(formData.get('project_id'))
    : null;
  const content = formData.get('content') as string;

  db.prepare(
    'INSERT INTO activity_logs (client_id, project_id, content) VALUES (?, ?, ?)'
  ).run(clientId, projectId, content);

  // Update client's updated_at
  db.prepare("UPDATE clients SET updated_at = datetime('now') WHERE id = ?").run(clientId);

  revalidatePath(`/clients/${clientId}`);
  if (projectId) {
    revalidatePath(`/clients/${clientId}/projects/${projectId}`);
  }
}
```

- [ ] **Step 10: Verify client pages render**

```bash
cd /Users/philipsmith/commandpost && npm run dev
```

Visit http://localhost:3000/clients. Create a new client. View the client detail. Edit the client. Add an activity note.

- [ ] **Step 11: Commit**

```bash
cd /Users/philipsmith/commandpost
git add src/components/ "src/app/(dashboard)/clients/" src/lib/actions/activity-actions.ts
git commit -m "feat: add client CRUD pages with activity log"
```

---

### Task 7: Project & Deliverable CRUD

**Files:**
- Create: `src/lib/queries/project-queries.ts`, `src/lib/actions/project-actions.ts`, `src/lib/actions/deliverable-actions.ts`, `src/components/project-form.tsx`, `src/components/deliverable-list.tsx`, `src/app/(dashboard)/clients/[id]/projects/new/page.tsx`, `src/app/(dashboard)/clients/[id]/projects/[projectId]/page.tsx`, `src/app/(dashboard)/clients/[id]/projects/[projectId]/edit/page.tsx`, `tests/actions/project-actions.test.ts`

- [ ] **Step 1: Write failing test for project queries**

Create `tests/actions/project-actions.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initDb } from '@/lib/db';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-projects.db');

describe('project queries', () => {
  let db: Database.Database;
  let clientId: number;

  beforeEach(async () => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    db = initDb(TEST_DB_PATH);
    const { createClient } = await import('@/lib/queries/client-queries');
    clientId = createClient(db, { name: 'Test Client', status: 'active' });
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('creates and retrieves a project', async () => {
    const { createProject, getProjectById } = await import('@/lib/queries/project-queries');

    const id = createProject(db, {
      client_id: clientId,
      name: 'AI Writing Tool',
      status: 'active',
      server_ip: '165.227.185.182',
      repo_url: 'https://github.com/test/repo',
    });

    const project = getProjectById(db, id);
    expect(project).toBeTruthy();
    expect(project!.name).toBe('AI Writing Tool');
    expect(project!.server_ip).toBe('165.227.185.182');
  });

  it('creates and retrieves deliverables', async () => {
    const { createProject } = await import('@/lib/queries/project-queries');
    const { createDeliverable, listDeliverables, updateDeliverableStatus } = await import('@/lib/queries/project-queries');

    const projectId = createProject(db, { client_id: clientId, name: 'Test', status: 'active' });

    createDeliverable(db, { project_id: projectId, title: 'Design mockup', due_date: '2026-06-01' });
    createDeliverable(db, { project_id: projectId, title: 'Backend API', due_date: '2026-06-15' });

    const deliverables = listDeliverables(db, projectId);
    expect(deliverables).toHaveLength(2);
    expect(deliverables[0].status).toBe('not_started');

    updateDeliverableStatus(db, deliverables[0].id, 'delivered');
    const updated = listDeliverables(db, projectId);
    expect(updated[0].status).toBe('delivered');
    expect(updated[0].completed_at).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/philipsmith/commandpost && npx vitest run tests/actions/project-actions.test.ts
```

Expected: FAIL — module `@/lib/queries/project-queries` not found.

- [ ] **Step 3: Implement project queries**

Create `src/lib/queries/project-queries.ts`:

```typescript
import type Database from 'better-sqlite3';
import type { Project, Deliverable, ProjectStatus, DeliverableStatus } from '@/lib/types';

interface CreateProjectInput {
  client_id: number;
  name: string;
  status: ProjectStatus;
  start_date?: string | null;
  server_ip?: string | null;
  repo_url?: string | null;
  deploy_command?: string | null;
  stack_notes?: string | null;
}

interface CreateDeliverableInput {
  project_id: number;
  title: string;
  due_date?: string | null;
}

export function createProject(db: Database.Database, input: CreateProjectInput): number {
  const result = db.prepare(`
    INSERT INTO projects (client_id, name, status, start_date, server_ip, repo_url, deploy_command, stack_notes)
    VALUES (@client_id, @name, @status, @start_date, @server_ip, @repo_url, @deploy_command, @stack_notes)
  `).run({
    client_id: input.client_id,
    name: input.name,
    status: input.status,
    start_date: input.start_date ?? null,
    server_ip: input.server_ip ?? null,
    repo_url: input.repo_url ?? null,
    deploy_command: input.deploy_command ?? null,
    stack_notes: input.stack_notes ?? null,
  });

  return Number(result.lastInsertRowid);
}

export function getProjectById(db: Database.Database, id: number): Project | undefined {
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project | undefined;
}

export function listProjectsByClient(db: Database.Database, clientId: number): Project[] {
  return db.prepare('SELECT * FROM projects WHERE client_id = ? ORDER BY created_at DESC').all(clientId) as Project[];
}

export function updateProject(db: Database.Database, id: number, input: Partial<CreateProjectInput>): void {
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

  db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = @id`).run(params);
}

export function deleteProject(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
}

export function createDeliverable(db: Database.Database, input: CreateDeliverableInput): number {
  const result = db.prepare(
    'INSERT INTO deliverables (project_id, title, due_date) VALUES (?, ?, ?)'
  ).run(input.project_id, input.title, input.due_date ?? null);

  return Number(result.lastInsertRowid);
}

export function listDeliverables(db: Database.Database, projectId: number): Deliverable[] {
  return db.prepare('SELECT * FROM deliverables WHERE project_id = ? ORDER BY due_date ASC, created_at ASC').all(projectId) as Deliverable[];
}

export function updateDeliverableStatus(db: Database.Database, id: number, status: DeliverableStatus): void {
  const completedAt = status === 'delivered' ? "datetime('now')" : 'NULL';
  db.prepare(`UPDATE deliverables SET status = ?, completed_at = ${completedAt} WHERE id = ?`).run(status, id);
}

export function deleteDeliverable(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM deliverables WHERE id = ?').run(id);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/philipsmith/commandpost && npx vitest run tests/actions/project-actions.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Create project server actions**

Create `src/lib/actions/project-actions.ts`:

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { createProject, updateProject, deleteProject } from '@/lib/queries/project-queries';
import type { ProjectStatus } from '@/lib/types';

export async function createProjectAction(formData: FormData) {
  const db = getDb();
  const clientId = Number(formData.get('client_id'));

  const id = createProject(db, {
    client_id: clientId,
    name: formData.get('name') as string,
    status: (formData.get('status') as ProjectStatus) || 'active',
    start_date: (formData.get('start_date') as string) || null,
    server_ip: (formData.get('server_ip') as string) || null,
    repo_url: (formData.get('repo_url') as string) || null,
    deploy_command: (formData.get('deploy_command') as string) || null,
    stack_notes: (formData.get('stack_notes') as string) || null,
  });

  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}/projects/${id}`);
}

export async function updateProjectAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  const clientId = Number(formData.get('client_id'));

  updateProject(db, id, {
    name: formData.get('name') as string,
    status: (formData.get('status') as ProjectStatus) || 'active',
    start_date: (formData.get('start_date') as string) || null,
    server_ip: (formData.get('server_ip') as string) || null,
    repo_url: (formData.get('repo_url') as string) || null,
    deploy_command: (formData.get('deploy_command') as string) || null,
    stack_notes: (formData.get('stack_notes') as string) || null,
  });

  revalidatePath(`/clients/${clientId}/projects/${id}`);
  redirect(`/clients/${clientId}/projects/${id}`);
}

export async function deleteProjectAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  const clientId = Number(formData.get('client_id'));
  deleteProject(db, id);
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}
```

- [ ] **Step 6: Create deliverable server actions**

Create `src/lib/actions/deliverable-actions.ts`:

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import {
  createDeliverable,
  updateDeliverableStatus,
  deleteDeliverable,
} from '@/lib/queries/project-queries';
import type { DeliverableStatus } from '@/lib/types';

export async function addDeliverableAction(formData: FormData) {
  const db = getDb();
  const projectId = Number(formData.get('project_id'));
  const clientId = Number(formData.get('client_id'));

  createDeliverable(db, {
    project_id: projectId,
    title: formData.get('title') as string,
    due_date: (formData.get('due_date') as string) || null,
  });

  revalidatePath(`/clients/${clientId}/projects/${projectId}`);
}

export async function updateDeliverableStatusAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  const status = formData.get('status') as DeliverableStatus;
  const clientId = Number(formData.get('client_id'));
  const projectId = Number(formData.get('project_id'));

  updateDeliverableStatus(db, id, status);
  revalidatePath(`/clients/${clientId}/projects/${projectId}`);
}

export async function deleteDeliverableAction(formData: FormData) {
  const db = getDb();
  const id = Number(formData.get('id'));
  const clientId = Number(formData.get('client_id'));
  const projectId = Number(formData.get('project_id'));

  deleteDeliverable(db, id);
  revalidatePath(`/clients/${clientId}/projects/${projectId}`);
}
```

- [ ] **Step 7: Create project form component**

Create `src/components/project-form.tsx`:

```tsx
import type { Project } from '@/lib/types';

interface ProjectFormProps {
  action: (formData: FormData) => void;
  clientId: number;
  project?: Project;
  submitLabel: string;
}

export function ProjectForm({ action, clientId, project, submitLabel }: ProjectFormProps) {
  return (
    <form action={action} className="space-y-4 max-w-lg">
      <input type="hidden" name="client_id" value={clientId} />
      {project && <input type="hidden" name="id" value={project.id} />}

      <div>
        <label className="block text-sm text-gray-400 mb-1">Project Name *</label>
        <input
          type="text"
          name="name"
          required
          defaultValue={project?.name}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Status</label>
          <select
            name="status"
            defaultValue={project?.status ?? 'active'}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
          >
            <option value="active">Active</option>
            <option value="on-hold">On Hold</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Start Date</label>
          <input
            type="date"
            name="start_date"
            defaultValue={project?.start_date ?? ''}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Server IP</label>
        <input
          type="text"
          name="server_ip"
          placeholder="e.g., 165.227.185.182"
          defaultValue={project?.server_ip ?? ''}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Repo URL</label>
        <input
          type="text"
          name="repo_url"
          placeholder="e.g., https://github.com/user/repo"
          defaultValue={project?.repo_url ?? ''}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Deploy Command</label>
        <textarea
          name="deploy_command"
          rows={2}
          placeholder='e.g., ssh root@ip "cd /root/app && git pull && docker compose up -d --build"'
          defaultValue={project?.deploy_command ?? ''}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Stack Notes</label>
        <textarea
          name="stack_notes"
          rows={3}
          placeholder="e.g., FastAPI + Next.js + ChromaDB, Docker Compose (8 containers)"
          defaultValue={project?.stack_notes ?? ''}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
        />
      </div>

      <button
        type="submit"
        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
      >
        {submitLabel}
      </button>
    </form>
  );
}
```

- [ ] **Step 8: Create deliverable list component**

Create `src/components/deliverable-list.tsx`:

```tsx
'use client';

import { useRef } from 'react';
import {
  addDeliverableAction,
  updateDeliverableStatusAction,
  deleteDeliverableAction,
} from '@/lib/actions/deliverable-actions';
import type { Deliverable, DeliverableStatus } from '@/lib/types';

interface DeliverableListProps {
  clientId: number;
  projectId: number;
  deliverables: Deliverable[];
}

const statusCycle: Record<DeliverableStatus, DeliverableStatus> = {
  not_started: 'in_progress',
  in_progress: 'delivered',
  delivered: 'not_started',
};

const statusIcon: Record<DeliverableStatus, string> = {
  not_started: '○',
  in_progress: '◐',
  delivered: '●',
};

const statusColor: Record<DeliverableStatus, string> = {
  not_started: 'text-gray-500',
  in_progress: 'text-blue-400',
  delivered: 'text-green-400',
};

export function DeliverableList({ clientId, projectId, deliverables }: DeliverableListProps) {
  const formRef = useRef<HTMLFormElement>(null);

  async function handleAdd(formData: FormData) {
    await addDeliverableAction(formData);
    formRef.current?.reset();
  }

  function isOverdue(d: Deliverable): boolean {
    if (!d.due_date || d.status === 'delivered') return false;
    return new Date(d.due_date) < new Date();
  }

  function isDueSoon(d: Deliverable): boolean {
    if (!d.due_date || d.status === 'delivered') return false;
    const due = new Date(d.due_date);
    const now = new Date();
    const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 3;
  }

  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold mb-4">Deliverables</h3>

      {deliverables.length > 0 && (
        <div className="space-y-1 mb-4">
          {deliverables.map((d) => (
            <div
              key={d.id}
              className={`flex items-center gap-3 p-2.5 rounded-lg border ${
                isOverdue(d)
                  ? 'border-red-900 bg-red-900/10'
                  : isDueSoon(d)
                  ? 'border-yellow-900 bg-yellow-900/10'
                  : 'border-gray-800 bg-gray-900'
              }`}
            >
              <form action={updateDeliverableStatusAction}>
                <input type="hidden" name="id" value={d.id} />
                <input type="hidden" name="client_id" value={clientId} />
                <input type="hidden" name="project_id" value={projectId} />
                <input type="hidden" name="status" value={statusCycle[d.status]} />
                <button
                  type="submit"
                  className={`text-lg ${statusColor[d.status]} hover:opacity-70`}
                  title={`Click to change to ${statusCycle[d.status].replace(/_/g, ' ')}`}
                >
                  {statusIcon[d.status]}
                </button>
              </form>

              <span className={`flex-1 text-sm ${d.status === 'delivered' ? 'line-through text-gray-500' : 'text-white'}`}>
                {d.title}
              </span>

              {d.due_date && (
                <span className={`text-xs ${isOverdue(d) ? 'text-red-400' : isDueSoon(d) ? 'text-yellow-400' : 'text-gray-500'}`}>
                  {new Date(d.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}

              <form action={deleteDeliverableAction}>
                <input type="hidden" name="id" value={d.id} />
                <input type="hidden" name="client_id" value={clientId} />
                <input type="hidden" name="project_id" value={projectId} />
                <button type="submit" className="text-gray-600 hover:text-red-400 text-xs">
                  x
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      <form ref={formRef} action={handleAdd} className="flex gap-2">
        <input type="hidden" name="project_id" value={projectId} />
        <input type="hidden" name="client_id" value={clientId} />
        <input
          type="text"
          name="title"
          required
          placeholder="Add a deliverable..."
          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        <input
          type="date"
          name="due_date"
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Add
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 9: Create project pages (new, detail, edit)**

Create `src/app/(dashboard)/clients/[id]/projects/new/page.tsx`:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getClientById } from '@/lib/queries/client-queries';
import { ProjectForm } from '@/components/project-form';
import { createProjectAction } from '@/lib/actions/project-actions';

export default async function NewProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const client = getClientById(db, Number(id));
  if (!client) notFound();

  return (
    <div className="p-6">
      <Link href={`/clients/${id}`} className="text-sm text-gray-400 hover:text-white mb-4 inline-block">
        &larr; Back to {client.name}
      </Link>
      <h2 className="text-2xl font-bold mb-6">New Project</h2>
      <ProjectForm action={createProjectAction} clientId={client.id} submitLabel="Create Project" />
    </div>
  );
}
```

Create `src/app/(dashboard)/clients/[id]/projects/[projectId]/page.tsx`:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getClientById } from '@/lib/queries/client-queries';
import { getProjectById, listDeliverables } from '@/lib/queries/project-queries';
import { deleteProjectAction } from '@/lib/actions/project-actions';
import { StatusBadge } from '@/components/status-badge';
import { DeliverableList } from '@/components/deliverable-list';
import { ActivityLog } from '@/components/activity-log';

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string; projectId: string }>;
}) {
  const { id, projectId } = await params;
  const db = getDb();
  const client = getClientById(db, Number(id));
  const project = getProjectById(db, Number(projectId));

  if (!client || !project) notFound();

  const deliverables = listDeliverables(db, project.id);
  const activities = db
    .prepare('SELECT * FROM activity_logs WHERE project_id = ? ORDER BY created_at DESC LIMIT 50')
    .all(project.id) as any[];

  return (
    <div className="p-6">
      <Link href={`/clients/${id}`} className="text-sm text-gray-400 hover:text-white mb-4 inline-block">
        &larr; Back to {client.name}
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">{project.name}</h2>
          <p className="text-gray-400 text-sm">{client.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={project.status} />
          <Link
            href={`/clients/${id}/projects/${projectId}/edit`}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg hover:border-gray-600 transition-colors"
          >
            Edit
          </Link>
        </div>
      </div>

      {/* Tech Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {project.server_ip && (
          <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
            <p className="text-xs text-gray-500 uppercase mb-1">Server IP</p>
            <p className="text-sm text-white font-mono">{project.server_ip}</p>
          </div>
        )}
        {project.repo_url && (
          <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
            <p className="text-xs text-gray-500 uppercase mb-1">Repo</p>
            <p className="text-sm text-blue-400 font-mono truncate">{project.repo_url}</p>
          </div>
        )}
        {project.deploy_command && (
          <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg md:col-span-2">
            <p className="text-xs text-gray-500 uppercase mb-1">Deploy Command</p>
            <pre className="text-sm text-white font-mono whitespace-pre-wrap">{project.deploy_command}</pre>
          </div>
        )}
        {project.stack_notes && (
          <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg md:col-span-2">
            <p className="text-xs text-gray-500 uppercase mb-1">Stack</p>
            <p className="text-sm text-white whitespace-pre-wrap">{project.stack_notes}</p>
          </div>
        )}
      </div>

      {/* Deliverables */}
      <DeliverableList clientId={client.id} projectId={project.id} deliverables={deliverables} />

      {/* Activity Log */}
      <ActivityLog clientId={client.id} projectId={project.id} activities={activities} />

      {/* Danger Zone */}
      <div className="mt-12 pt-6 border-t border-gray-800">
        <form action={deleteProjectAction}>
          <input type="hidden" name="id" value={project.id} />
          <input type="hidden" name="client_id" value={client.id} />
          <button
            type="submit"
            className="px-4 py-2 text-sm text-red-400 border border-red-900 rounded-lg hover:bg-red-900/20 transition-colors"
            onClick={(e) => {
              if (!confirm('Delete this project? This cannot be undone.')) {
                e.preventDefault();
              }
            }}
          >
            Delete Project
          </button>
        </form>
      </div>
    </div>
  );
}
```

Create `src/app/(dashboard)/clients/[id]/projects/[projectId]/edit/page.tsx`:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getClientById } from '@/lib/queries/client-queries';
import { getProjectById } from '@/lib/queries/project-queries';
import { ProjectForm } from '@/components/project-form';
import { updateProjectAction } from '@/lib/actions/project-actions';

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string; projectId: string }>;
}) {
  const { id, projectId } = await params;
  const db = getDb();
  const client = getClientById(db, Number(id));
  const project = getProjectById(db, Number(projectId));

  if (!client || !project) notFound();

  return (
    <div className="p-6">
      <Link
        href={`/clients/${id}/projects/${projectId}`}
        className="text-sm text-gray-400 hover:text-white mb-4 inline-block"
      >
        &larr; Back to {project.name}
      </Link>
      <h2 className="text-2xl font-bold mb-6">Edit Project</h2>
      <ProjectForm action={updateProjectAction} clientId={client.id} project={project} submitLabel="Save Changes" />
    </div>
  );
}
```

- [ ] **Step 10: Verify project pages render**

```bash
cd /Users/philipsmith/commandpost && npm run dev
```

Navigate to a client, add a project, add deliverables, toggle deliverable statuses, add activity notes.

- [ ] **Step 11: Commit**

```bash
cd /Users/philipsmith/commandpost
git add src/lib/queries/project-queries.ts src/lib/actions/project-actions.ts src/lib/actions/deliverable-actions.ts src/components/project-form.tsx src/components/deliverable-list.tsx "src/app/(dashboard)/clients/[id]/projects/" tests/actions/project-actions.test.ts
git commit -m "feat: add project and deliverable CRUD with UI pages"
```

---

### Task 8: Dashboard (Morning Briefing)

**Files:**
- Create: `src/lib/queries/dashboard-queries.ts`, `src/components/alert-bar.tsx`, `tests/queries/dashboard-queries.test.ts`
- Modify: `src/app/(dashboard)/page.tsx`

- [ ] **Step 1: Write failing test for dashboard queries**

Create `tests/queries/dashboard-queries.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initDb } from '@/lib/db';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-dashboard.db');

describe('dashboard queries', () => {
  let db: Database.Database;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    db = initDb(TEST_DB_PATH);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('returns correct summary stats', async () => {
    const { getDashboardSummary } = await import('@/lib/queries/dashboard-queries');

    db.prepare("INSERT INTO clients (name, status, monthly_value) VALUES (?, ?, ?)").run('Client A', 'active', 3000);
    db.prepare("INSERT INTO clients (name, status, monthly_value) VALUES (?, ?, ?)").run('Client B', 'active', 2000);
    db.prepare("INSERT INTO clients (name, status) VALUES (?, ?)").run('Client C', 'completed');

    const summary = getDashboardSummary(db);
    expect(summary.activeClients).toBe(2);
    expect(summary.monthlyRevenue).toBe(5000);
  });

  it('returns overdue deliverables as action items', async () => {
    const { getActionItems } = await import('@/lib/queries/dashboard-queries');

    const clientId = Number(db.prepare("INSERT INTO clients (name, status) VALUES (?, ?)").run('Test', 'active').lastInsertRowid);
    const projectId = Number(db.prepare("INSERT INTO projects (client_id, name, status) VALUES (?, ?, ?)").run(clientId, 'Proj', 'active').lastInsertRowid);

    // Overdue deliverable
    db.prepare("INSERT INTO deliverables (project_id, title, status, due_date) VALUES (?, ?, ?, ?)").run(projectId, 'Overdue item', 'in_progress', '2025-01-01');

    // Future deliverable
    db.prepare("INSERT INTO deliverables (project_id, title, status, due_date) VALUES (?, ?, ?, ?)").run(projectId, 'Future item', 'not_started', '2099-12-31');

    const items = getActionItems(db);
    const overdueItems = items.filter(i => i.type === 'overdue_deliverable');
    expect(overdueItems).toHaveLength(1);
    expect(overdueItems[0].title).toContain('Overdue item');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/philipsmith/commandpost && npx vitest run tests/queries/dashboard-queries.test.ts
```

Expected: FAIL — module `@/lib/queries/dashboard-queries` not found.

- [ ] **Step 3: Implement dashboard queries**

Create `src/lib/queries/dashboard-queries.ts`:

```typescript
import type Database from 'better-sqlite3';

export interface DashboardSummary {
  activeClients: number;
  overdueDeliverables: number;
  monthlyRevenue: number;
}

export interface ActionItem {
  type: 'overdue_deliverable' | 'due_soon_deliverable';
  title: string;
  link: string;
  urgency: 'red' | 'yellow';
}

export interface RecentActivity {
  content: string;
  created_at: string;
  client_name: string;
}

export function getDashboardSummary(db: Database.Database): DashboardSummary {
  const activeClients = (
    db.prepare("SELECT COUNT(*) as count FROM clients WHERE status = 'active' AND deleted_at IS NULL").get() as any
  ).count;

  const overdueDeliverables = (
    db.prepare(`
      SELECT COUNT(*) as count FROM deliverables d
      JOIN projects p ON d.project_id = p.id
      JOIN clients c ON p.client_id = c.id
      WHERE d.status != 'delivered'
        AND d.due_date < date('now')
        AND c.deleted_at IS NULL
    `).get() as any
  ).count;

  const monthlyRevenue = (
    db.prepare("SELECT COALESCE(SUM(monthly_value), 0) as total FROM clients WHERE status = 'active' AND deleted_at IS NULL").get() as any
  ).total;

  return { activeClients, overdueDeliverables, monthlyRevenue };
}

export function getActionItems(db: Database.Database): ActionItem[] {
  const items: ActionItem[] = [];

  // Overdue deliverables
  const overdue = db.prepare(`
    SELECT d.title, d.due_date, p.id as project_id, p.name as project_name, c.id as client_id, c.name as client_name
    FROM deliverables d
    JOIN projects p ON d.project_id = p.id
    JOIN clients c ON p.client_id = c.id
    WHERE d.status != 'delivered'
      AND d.due_date < date('now')
      AND c.deleted_at IS NULL
    ORDER BY d.due_date ASC
  `).all() as any[];

  for (const d of overdue) {
    items.push({
      type: 'overdue_deliverable',
      title: `Overdue: ${d.title} (${d.client_name} / ${d.project_name})`,
      link: `/clients/${d.client_id}/projects/${d.project_id}`,
      urgency: 'red',
    });
  }

  // Due within 3 days
  const dueSoon = db.prepare(`
    SELECT d.title, d.due_date, p.id as project_id, p.name as project_name, c.id as client_id, c.name as client_name
    FROM deliverables d
    JOIN projects p ON d.project_id = p.id
    JOIN clients c ON p.client_id = c.id
    WHERE d.status != 'delivered'
      AND d.due_date >= date('now')
      AND d.due_date <= date('now', '+3 days')
      AND c.deleted_at IS NULL
    ORDER BY d.due_date ASC
  `).all() as any[];

  for (const d of dueSoon) {
    items.push({
      type: 'due_soon_deliverable',
      title: `Due soon: ${d.title} (${d.client_name} / ${d.project_name}) — ${d.due_date}`,
      link: `/clients/${d.client_id}/projects/${d.project_id}`,
      urgency: 'yellow',
    });
  }

  return items;
}

export function getRecentActivity(db: Database.Database, limit: number = 20): RecentActivity[] {
  return db.prepare(`
    SELECT a.content, a.created_at, c.name as client_name
    FROM activity_logs a
    JOIN clients c ON a.client_id = c.id
    WHERE c.deleted_at IS NULL
    ORDER BY a.created_at DESC
    LIMIT ?
  `).all(limit) as RecentActivity[];
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/philipsmith/commandpost && npx vitest run tests/queries/dashboard-queries.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Create alert bar component**

Create `src/components/alert-bar.tsx`:

```tsx
import Link from 'next/link';
import type { ActionItem } from '@/lib/queries/dashboard-queries';

export function AlertBar({ items }: { items: ActionItem[] }) {
  const redItems = items.filter((i) => i.urgency === 'red');

  if (redItems.length === 0) return null;

  return (
    <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 mb-6">
      <p className="text-sm font-medium text-red-300 mb-2">
        {redItems.length} critical item{redItems.length > 1 ? 's' : ''} need attention
      </p>
      <ul className="space-y-1">
        {redItems.slice(0, 5).map((item, i) => (
          <li key={i}>
            <Link href={item.link} className="text-sm text-red-400 hover:text-red-300 underline">
              {item.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 6: Build the dashboard page**

Replace `src/app/(dashboard)/page.tsx`:

```tsx
import Link from 'next/link';
import { getDb } from '@/lib/db';
import {
  getDashboardSummary,
  getActionItems,
  getRecentActivity,
} from '@/lib/queries/dashboard-queries';
import { AlertBar } from '@/components/alert-bar';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  const db = getDb();
  const summary = getDashboardSummary(db);
  const actionItems = getActionItems(db);
  const recentActivity = getRecentActivity(db);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-1">{greeting}</h2>
      <p className="text-gray-400 mb-6">
        {new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })}
      </p>

      {/* Alert Bar */}
      <AlertBar items={actionItems} />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Active Clients</p>
          <p className="text-2xl font-bold text-white">{summary.activeClients}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Monthly Revenue</p>
          <p className="text-2xl font-bold text-white">
            ${summary.monthlyRevenue.toLocaleString()}
          </p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Overdue Items</p>
          <p className={`text-2xl font-bold ${summary.overdueDeliverables > 0 ? 'text-red-400' : 'text-white'}`}>
            {summary.overdueDeliverables}
          </p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Pipeline</p>
          <p className="text-2xl font-bold text-gray-500">—</p>
          <p className="text-xs text-gray-600">Coming in Phase 2</p>
        </div>
      </div>

      {/* Action Items */}
      {actionItems.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-3">Action Items</h3>
          <div className="space-y-2">
            {actionItems.map((item, i) => (
              <Link
                key={i}
                href={item.link}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  item.urgency === 'red'
                    ? 'border-red-900 bg-red-900/10 hover:bg-red-900/20'
                    : 'border-yellow-900 bg-yellow-900/10 hover:bg-yellow-900/20'
                }`}
              >
                <span className={`text-xs font-medium uppercase ${
                  item.urgency === 'red' ? 'text-red-400' : 'text-yellow-400'
                }`}>
                  {item.urgency === 'red' ? 'OVERDUE' : 'DUE SOON'}
                </span>
                <span className="text-sm text-white">{item.title}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Recent Activity</h3>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-gray-500">No activity yet. Start by adding clients and notes.</p>
        ) : (
          <div className="space-y-2">
            {recentActivity.map((activity, i) => (
              <div
                key={i}
                className="flex gap-3 p-3 bg-gray-900 border border-gray-800 rounded-lg"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-gray-600 mt-2 shrink-0" />
                <div>
                  <p className="text-sm text-white">{activity.content}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {activity.client_name} &middot;{' '}
                    {new Date(activity.created_at + 'Z').toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Verify dashboard renders**

```bash
cd /Users/philipsmith/commandpost && npm run dev
```

Visit http://localhost:3000. Should see greeting, summary cards, action items (if any deliverables are overdue), and recent activity.

- [ ] **Step 8: Commit**

```bash
cd /Users/philipsmith/commandpost
git add src/lib/queries/dashboard-queries.ts src/components/alert-bar.tsx "src/app/(dashboard)/page.tsx" tests/queries/dashboard-queries.test.ts
git commit -m "feat: add dashboard morning briefing with summary, actions, and activity"
```

---

### Task 9: Run All Tests + Final Verification

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/philipsmith/commandpost && npx vitest run
```

Expected: All tests pass.

- [ ] **Step 2: Build production bundle**

```bash
cd /Users/philipsmith/commandpost && npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Manual smoke test**

```bash
cd /Users/philipsmith/commandpost && npm run dev
```

Test the following flow:
1. Visit http://localhost:3000 — redirected to login
2. Enter password — redirected to dashboard
3. Dashboard shows greeting, empty state cards
4. Navigate to Clients → Create a client (e.g., "Paul Winkler Inc")
5. View client detail → Add a project (e.g., "AI Writing Tool")
6. Add deliverables with due dates
7. Toggle deliverable statuses
8. Add activity notes on client and project
9. Return to Dashboard — verify summary cards update, activity feed shows notes
10. Test on mobile viewport (Chrome DevTools) — bottom nav appears, sidebar hidden
11. Sign out — returns to login

- [ ] **Step 4: Commit any final fixes**

```bash
cd /Users/philipsmith/commandpost
git status
# If any fixes were needed:
git add -A && git commit -m "fix: final adjustments from smoke testing"
```

---

## Phase 1 Complete

After this phase you have:
- Authenticated Next.js app with dark theme
- Sidebar + mobile bottom nav
- Full Client CRUD (create, read, update, soft delete)
- Full Project CRUD with tech details (server IP, repo, deploy command, stack notes)
- Deliverable checklist with status toggling and overdue/due-soon highlighting
- Activity log on clients and projects
- Dashboard morning briefing with summary cards, action items, and recent activity

## Next Phases (Separate Plans)

- **Phase 2:** Pipeline module (kanban board, lead CRUD, follow-up tracking, Won→Client conversion)
- **Phase 3:** Finances module (invoices, Stripe integration, revenue dashboard, expenses, profitability)
- **Phase 4:** Ops Monitor (health checks, incident tracking)
- **Phase 5:** SMS Alerts (Twilio, morning briefing batch, scheduled summaries)
- **Phase 6:** Polish (PDF invoices, disk monitoring agent, mobile optimization)
