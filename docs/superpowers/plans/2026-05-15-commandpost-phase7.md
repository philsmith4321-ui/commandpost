# CommandPost Phase 7: AI-Powered Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three Claude-powered features: natural language dashboard queries, lead follow-up draft generation, and weekly business insights in the Monday SMS briefing.

**Architecture:** A shared Claude API utility (`src/lib/claude.ts`) wraps the Anthropic Messages API using raw fetch (no SDK). Three independent features consume it: a server action for NL queries, a server action for follow-up drafts, and an extension to the morning briefing script. All gated behind `ANTHROPIC_API_KEY` env var.

**Tech Stack:** Next.js 16, Anthropic Messages API (claude-sonnet-4-20250514), React 19 useActionState, Vitest.

---

## File Structure

```
src/
  lib/
    claude.ts                                # CREATE: isClaudeConfigured + askClaude
    actions/
      dashboard-actions.ts                   # CREATE: askDashboardQuestion
      lead-actions.ts                        # MODIFY: add generateFollowUp
  app/
    (dashboard)/
      page.tsx                               # MODIFY: add query widget
      pipeline/[id]/page.tsx                 # MODIFY: add follow-up draft component
  components/
    dashboard-query.tsx                      # CREATE: NL query widget
    follow-up-draft.tsx                      # CREATE: follow-up draft UI
scripts/
  sms-alerts.ts                              # MODIFY: add weekly insights
tests/
  lib/
    claude.test.ts                           # CREATE
```

---

### Task 1: Claude API utility + tests

**Files:**
- Create: `src/lib/claude.ts`
- Create: `tests/lib/claude.test.ts`

- [ ] **Step 1: Write tests for claude utility**

Create `tests/lib/claude.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('claude utility', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it('isClaudeConfigured returns false when env var missing', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { isClaudeConfigured } = await import('@/lib/claude');
    expect(isClaudeConfigured()).toBe(false);
  });

  it('isClaudeConfigured returns true when env var set', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    const { isClaudeConfigured } = await import('@/lib/claude');
    expect(isClaudeConfigured()).toBe(true);
  });

  it('askClaude calls Anthropic API with correct params', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        content: [{ type: 'text', text: 'Hello from Claude' }],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { askClaude } = await import('@/lib/claude');
    const result = await askClaude('You are helpful.', 'Say hello');

    expect(result).toBe('Hello from Claude');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(options.method).toBe('POST');
    expect(options.headers['x-api-key']).toBe('sk-ant-test');
    expect(options.headers['anthropic-version']).toBe('2023-06-01');

    const body = JSON.parse(options.body);
    expect(body.model).toBe('claude-sonnet-4-20250514');
    expect(body.max_tokens).toBe(1024);
    expect(body.system).toBe('You are helpful.');
    expect(body.messages[0].content).toBe('Say hello');
  });

  it('askClaude returns null on API failure', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { askClaude } = await import('@/lib/claude');
    const result = await askClaude('system', 'user');

    expect(result).toBeNull();
  });

  it('askClaude respects custom maxTokens', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        content: [{ type: 'text', text: 'Short' }],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { askClaude } = await import('@/lib/claude');
    await askClaude('system', 'user', 200);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.max_tokens).toBe(200);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/philipsmith/commandpost && npx vitest run tests/lib/claude.test.ts 2>&1 | tail -10`
Expected: FAIL — module not found.

- [ ] **Step 3: Create claude.ts**

Create `src/lib/claude.ts`:

```typescript
export function isClaudeConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function askClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 1024
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Claude API error (${response.status}): ${text}`);
      return null;
    }

    const data = await response.json();
    return data.content[0].text;
  } catch (err) {
    console.error('Claude API request failed:', err);
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/philipsmith/commandpost && npx vitest run tests/lib/claude.test.ts 2>&1 | tail -10`
Expected: All 5 tests pass.

- [ ] **Step 5: Run full test suite**

Run: `cd /Users/philipsmith/commandpost && npm test 2>&1 | tail -10`
Expected: All tests pass (71 existing + 5 new = 76).

- [ ] **Step 6: Commit**

```bash
git add src/lib/claude.ts tests/lib/claude.test.ts
git commit -m "feat: add Claude API utility with env gating and askClaude"
```

---

### Task 2: Dashboard query server action

**Files:**
- Create: `src/lib/actions/dashboard-actions.ts`

- [ ] **Step 1: Create the server action**

Create `src/lib/actions/dashboard-actions.ts`:

```typescript
'use server';

import { getDb } from '@/lib/db';
import { isClaudeConfigured, askClaude } from '@/lib/claude';

const DB_SCHEMA = `Tables:
- clients (id, name, contact_person, email, phone, notes, source, status ['active','paused','completed'], monthly_value, created_at, updated_at, deleted_at)
- projects (id, client_id FK->clients, name, status ['active','on-hold','completed'], start_date, server_ip, repo_url, deploy_command, stack_notes, created_at, updated_at)
- deliverables (id, project_id FK->projects, title, status ['not_started','in_progress','delivered'], due_date, completed_at, created_at)
- activity_logs (id, client_id FK->clients, project_id FK->projects nullable, content, created_at)
- leads (id, business_name, contact_person, email, phone, website, source ['referral','website','outbound','other'], estimated_value, stage ['new','contacted','discovery','proposal','negotiating','won','lost'], lost_reason, follow_up_date, created_at, updated_at, converted_client_id FK->clients nullable)
- lead_stage_history (id, lead_id FK->leads, stage, entered_at)
- lead_notes (id, lead_id FK->leads, content, created_at)
- invoices (id, client_id FK->clients, invoice_number UNIQUE, status ['draft','sent','paid'], due_date, sent_at, paid_at, stripe_payment_link, stripe_payment_id, is_recurring, recurrence_day, total_amount, notes, created_at, updated_at)
- invoice_items (id, invoice_id FK->invoices, description, quantity, unit_price, amount)
- expenses (id, client_id FK->clients nullable, category ['servers','software','contractor','marketing','other'], description, amount, expense_date, created_at)
- endpoints (id, name, url, check_interval_seconds, slow_threshold_ms, is_active, created_at)
- health_checks (id, endpoint_id FK->endpoints, status_code, response_time_ms, is_healthy, checked_at)
- incidents (id, endpoint_id FK->endpoints, started_at, resolved_at, duration_seconds)

All dates are ISO 8601 text strings. Use date('now') for current date. Soft-deleted clients have deleted_at set — filter with deleted_at IS NULL.`;

const SQL_SYSTEM_PROMPT = `You are a SQL assistant for a business management app. Given a user's question, write a SQLite SELECT query to answer it. Return ONLY the SQL query, no explanation, no markdown fences.

${DB_SCHEMA}`;

const ANSWER_SYSTEM_PROMPT = `You are a helpful business assistant. Given a user's question and the database query results, provide a clear, concise answer. Use specific numbers. Keep it to 2-3 sentences.`;

function stripCodeFences(text: string): string {
  return text.replace(/^```(?:sql)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
}

function isReadOnly(sql: string): boolean {
  const upper = sql.toUpperCase();
  if (!upper.trimStart().startsWith('SELECT')) return false;
  const forbidden = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'REPLACE', 'ATTACH', 'DETACH'];
  for (const word of forbidden) {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(sql)) return false;
  }
  const statements = sql.split(';').filter(s => s.trim().length > 0);
  if (statements.length > 1) return false;
  return true;
}

export type QueryResult = { answer: string } | { error: string };

export async function askDashboardQuestion(
  _prevState: QueryResult | null,
  formData: FormData
): Promise<QueryResult> {
  const question = (formData.get('question') as string)?.trim();
  if (!question) return { error: 'Please enter a question.' };
  if (!isClaudeConfigured()) return { error: 'AI features not configured.' };

  // Step 1: Generate SQL
  const sqlResponse = await askClaude(SQL_SYSTEM_PROMPT, question);
  if (!sqlResponse) return { error: 'Failed to generate query. Please try again.' };

  const sql = stripCodeFences(sqlResponse);

  // Step 2: Validate
  if (!isReadOnly(sql)) {
    return { error: 'Generated query was not a safe read-only query. Please rephrase.' };
  }

  // Step 3: Execute
  const db = getDb();
  let results: unknown[];
  try {
    results = db.prepare(sql).all();
  } catch (err) {
    return { error: `Query failed: ${(err as Error).message}` };
  }

  // Step 4: Format answer
  const answerResponse = await askClaude(
    ANSWER_SYSTEM_PROMPT,
    `Question: ${question}\n\nQuery results: ${JSON.stringify(results).slice(0, 4000)}`
  );

  if (!answerResponse) return { error: 'Failed to format answer. Please try again.' };

  return { answer: answerResponse };
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `cd /Users/philipsmith/commandpost && npm run build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/dashboard-actions.ts
git commit -m "feat: add askDashboardQuestion server action with SQL generation and validation"
```

---

### Task 3: Dashboard query widget component

**Files:**
- Create: `src/components/dashboard-query.tsx`
- Modify: `src/app/(dashboard)/page.tsx`

- [ ] **Step 1: Create the query widget component**

Create `src/components/dashboard-query.tsx`:

```tsx
'use client';

import { useActionState } from 'react';
import { askDashboardQuestion, type QueryResult } from '@/lib/actions/dashboard-actions';

export function DashboardQuery() {
  const [state, formAction, isPending] = useActionState<QueryResult | null, FormData>(
    askDashboardQuestion,
    null
  );

  return (
    <div className="mb-6">
      <form action={formAction} className="flex gap-2">
        <input
          type="text"
          name="question"
          placeholder="Ask about your business..."
          className="flex-1 px-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          disabled={isPending}
        />
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:text-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {isPending ? 'Thinking...' : 'Ask'}
        </button>
      </form>
      {state && (
        <div className={`mt-3 p-4 rounded-lg border text-sm ${
          'error' in state
            ? 'bg-red-900/10 border-red-900 text-red-400'
            : 'bg-gray-900 border-gray-800 text-white'
        }`}>
          {'error' in state ? state.error : state.answer}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add query widget to dashboard page**

In `src/app/(dashboard)/page.tsx`:

Add import at the top:
```typescript
import { isClaudeConfigured } from '@/lib/claude';
import { DashboardQuery } from '@/components/dashboard-query';
```

Add `const claudeEnabled = isClaudeConfigured();` after the existing data fetching lines (after `const recentActivity = getRecentActivity(db);`).

In the JSX, after the `<p>` tag with the date (line ~22) and before `<AlertBar items={actionItems} />`, add:
```tsx
{claudeEnabled && <DashboardQuery />}
```

- [ ] **Step 3: Verify the build compiles**

Run: `cd /Users/philipsmith/commandpost && npm run build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard-query.tsx src/app/\(dashboard\)/page.tsx
git commit -m "feat: add natural language query widget to dashboard"
```

---

### Task 4: Lead follow-up draft server action

**Files:**
- Modify: `src/lib/actions/lead-actions.ts`

- [ ] **Step 1: Add generateFollowUp action**

In `src/lib/actions/lead-actions.ts`:

Add imports at the top (alongside existing imports):
```typescript
import { isClaudeConfigured, askClaude } from '@/lib/claude';
import { getLeadById, listLeadNotes, getStageHistory } from '@/lib/queries/lead-queries';
```

Add at the bottom of the file:

```typescript
export type FollowUpResult = {
  email_subject: string;
  email_body: string;
  talking_points: string[];
} | { error: string };

const FOLLOW_UP_SYSTEM_PROMPT = `You are a business development assistant for a web development freelancer. Generate a follow-up for a potential client.

Provide your response in EXACTLY this format:
EMAIL_SUBJECT: [subject line]
EMAIL_BODY:
[email body, 3-5 paragraphs]
END_EMAIL
TALKING_POINTS:
- [point 1]
- [point 2]
- [point 3]
- [point 4]

Base your tone and content on the lead's stage, history, and how long since last contact. Be warm but professional. Reference specific details from the notes when relevant.`;

function parseFollowUpResponse(text: string): FollowUpResult {
  const subjectMatch = text.match(/EMAIL_SUBJECT:\s*(.+)/);
  const bodyMatch = text.match(/EMAIL_BODY:\s*\n([\s\S]*?)\nEND_EMAIL/);
  const pointsMatch = text.match(/TALKING_POINTS:\s*\n([\s\S]*?)$/);

  if (!subjectMatch || !bodyMatch) {
    return { error: 'Failed to parse AI response. Please try again.' };
  }

  const talking_points = pointsMatch
    ? pointsMatch[1].split('\n').map(l => l.replace(/^-\s*/, '').trim()).filter(Boolean)
    : [];

  return {
    email_subject: subjectMatch[1].trim(),
    email_body: bodyMatch[1].trim(),
    talking_points,
  };
}

export async function generateFollowUp(
  _prevState: FollowUpResult | null,
  formData: FormData
): Promise<FollowUpResult> {
  if (!isClaudeConfigured()) return { error: 'AI features not configured.' };

  const id = Number(formData.get('id'));
  const db = getDb();
  const lead = getLeadById(db, id);
  if (!lead) return { error: 'Lead not found.' };

  const notes = listLeadNotes(db, id);
  const history = getStageHistory(db, id);

  const lastNoteDate = notes.length > 0 ? notes[0].created_at : null;
  const daysSinceLastNote = lastNoteDate
    ? Math.floor((Date.now() - new Date(lastNoteDate + 'Z').getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const context = `Lead: ${lead.business_name}
Contact: ${lead.contact_person || 'Unknown'}
Email: ${lead.email || 'Unknown'}
Stage: ${lead.stage}
Source: ${lead.source}
Estimated Value: ${lead.estimated_value ? `$${lead.estimated_value.toLocaleString()}` : 'Unknown'}
Days since last contact: ${daysSinceLastNote !== null ? daysSinceLastNote : 'No notes yet'}

Stage History:
${history.map(h => `- ${h.stage} (${h.entered_at})`).join('\n')}

Notes (newest first):
${notes.length > 0 ? notes.slice(0, 10).map(n => `[${n.created_at}] ${n.content}`).join('\n') : 'No notes recorded.'}`;

  const response = await askClaude(FOLLOW_UP_SYSTEM_PROMPT, context);
  if (!response) return { error: 'Failed to generate follow-up. Please try again.' };

  return parseFollowUpResponse(response);
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `cd /Users/philipsmith/commandpost && npm run build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/lead-actions.ts
git commit -m "feat: add generateFollowUp server action for lead follow-up drafts"
```

---

### Task 5: Follow-up draft component + lead page integration

**Files:**
- Create: `src/components/follow-up-draft.tsx`
- Modify: `src/app/(dashboard)/pipeline/[id]/page.tsx`

- [ ] **Step 1: Create the follow-up draft component**

Create `src/components/follow-up-draft.tsx`:

```tsx
'use client';

import { useActionState } from 'react';
import { generateFollowUp, type FollowUpResult } from '@/lib/actions/lead-actions';

export function FollowUpDraft({ leadId, isConfigured }: { leadId: number; isConfigured: boolean }) {
  const [state, formAction, isPending] = useActionState<FollowUpResult | null, FormData>(
    generateFollowUp,
    null
  );

  if (!isConfigured) return null;

  return (
    <div className="mb-8">
      <form action={formAction}>
        <input type="hidden" name="id" value={leadId} />
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:text-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {isPending ? 'Generating...' : 'Draft Follow-up'}
        </button>
      </form>

      {state && 'error' in state && (
        <div className="mt-3 p-4 bg-red-900/10 border border-red-900 rounded-lg text-sm text-red-400">
          {state.error}
        </div>
      )}

      {state && 'email_subject' in state && (
        <div className="mt-4 space-y-4">
          {/* Email Draft */}
          <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-400">Email Draft</h4>
              <CopyButton text={`Subject: ${state.email_subject}\n\n${state.email_body}`} />
            </div>
            <p className="text-sm font-medium text-white mb-2">Subject: {state.email_subject}</p>
            <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans">{state.email_body}</pre>
          </div>

          {/* Talking Points */}
          {state.talking_points.length > 0 && (
            <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Talking Points (Phone Call)</h4>
              <ul className="space-y-2">
                {state.talking_points.map((point, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-300">
                    <span className="text-blue-400 shrink-0">{i + 1}.</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
      }}
      className="px-3 py-1 text-xs text-gray-400 hover:text-white border border-gray-700 rounded hover:border-gray-600 transition-colors"
    >
      Copy
    </button>
  );
}
```

- [ ] **Step 2: Add follow-up draft to lead detail page**

In `src/app/(dashboard)/pipeline/[id]/page.tsx`:

Add imports at the top:
```typescript
import { isClaudeConfigured } from '@/lib/claude';
import { FollowUpDraft } from '@/components/follow-up-draft';
```

After the existing data fetching (after `const history = getStageHistory(db, lead.id);`), add:
```typescript
const claudeEnabled = isClaudeConfigured();
```

In the JSX, after the actions section (the `{lead.stage !== 'won' && lead.stage !== 'lost' && (` block that ends around line 106) and before the Won/Lost info sections, add:
```tsx
{lead.stage !== 'won' && lead.stage !== 'lost' && (
  <FollowUpDraft leadId={lead.id} isConfigured={claudeEnabled} />
)}
```

- [ ] **Step 3: Verify the build compiles**

Run: `cd /Users/philipsmith/commandpost && npm run build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/follow-up-draft.tsx src/app/\(dashboard\)/pipeline/\[id\]/page.tsx
git commit -m "feat: add follow-up draft UI to lead detail page"
```

---

### Task 6: Weekly insights in Monday SMS

**Files:**
- Modify: `scripts/sms-alerts.ts`

- [ ] **Step 1: Add Claude import and insights helper**

In `scripts/sms-alerts.ts`:

Add import at the top:
```typescript
import { isClaudeConfigured, askClaude } from '../src/lib/claude';
import { getRevenueByClient } from '../src/lib/queries/finance-queries';
```

Add the helper function after the existing `getLastMonthStats` function:

```typescript
function getWeeklyInsightsData(db: ReturnType<typeof initDb>): string {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
  const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const twoMonthsAgoStr = `${twoMonthsAgo.getFullYear()}-${String(twoMonthsAgo.getMonth() + 1).padStart(2, '0')}`;

  // Revenue trend
  const revenueThisMonth = (db.prepare(
    "SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'paid' AND strftime('%Y-%m', paid_at) = ?"
  ).get(thisMonth) as any).total;
  const revenueLastMonth = (db.prepare(
    "SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'paid' AND strftime('%Y-%m', paid_at) = ?"
  ).get(lastMonthStr) as any).total;
  const revenueTwoMonthsAgo = (db.prepare(
    "SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'paid' AND strftime('%Y-%m', paid_at) = ?"
  ).get(twoMonthsAgoStr) as any).total;

  // Revenue by client
  const topClients = getRevenueByClient(db, 5);

  // Leads stuck in stages 7+ days
  const stuckLeads = db.prepare(`
    SELECT l.business_name, l.stage,
      CAST(julianday('now') - julianday(MAX(h.entered_at)) AS INTEGER) as days_in_stage
    FROM leads l
    JOIN lead_stage_history h ON l.id = h.lead_id
    WHERE l.stage NOT IN ('won', 'lost')
    GROUP BY l.id
    HAVING days_in_stage >= 7
    ORDER BY days_in_stage DESC
  `).all() as any[];

  // Expense trend
  const expensesThisMonth = (db.prepare(
    "SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE strftime('%Y-%m', expense_date) = ?"
  ).get(thisMonth) as any).total;
  const expensesLastMonth = (db.prepare(
    "SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE strftime('%Y-%m', expense_date) = ?"
  ).get(lastMonthStr) as any).total;

  // Avg days to payment (last 90 days)
  const avgPaymentDays = (db.prepare(`
    SELECT COALESCE(AVG(julianday(paid_at) - julianday(sent_at)), 0) as avg_days
    FROM invoices
    WHERE status = 'paid' AND paid_at >= date('now', '-90 days') AND sent_at IS NOT NULL
  `).get() as any).avg_days;

  return `Revenue trend: This month $${revenueThisMonth.toLocaleString()}, last month $${revenueLastMonth.toLocaleString()}, 2 months ago $${revenueTwoMonthsAgo.toLocaleString()}.
Top clients by revenue: ${topClients.map(c => `${c.client_name} ($${c.total.toLocaleString()})`).join(', ') || 'None'}.
Leads stuck 7+ days: ${stuckLeads.length > 0 ? stuckLeads.map(l => `${l.business_name} in ${l.stage} for ${l.days_in_stage}d`).join(', ') : 'None'}.
Expenses: This month $${expensesThisMonth.toLocaleString()}, last month $${expensesLastMonth.toLocaleString()}.
Avg days to invoice payment (90d): ${Math.round(avgPaymentDays)} days.`;
}
```

- [ ] **Step 2: Add insights to the Monday block**

In `scripts/sms-alerts.ts`, inside the `if (isMonday)` block, after the existing `parts.push(`Pipeline: ...`)` line, add:

```typescript
    // AI insights
    if (isClaudeConfigured()) {
      const insightsData = getWeeklyInsightsData(db);
      const insights = await askClaude(
        'You are a business analyst. Given this week\'s business data, provide 2-3 brief, actionable insights. Each insight must be one sentence. Focus on trends, risks, and opportunities. Be specific with numbers. Keep total response under 280 characters.',
        insightsData,
        200
      );
      if (insights) {
        parts.push(`Insights: ${insights}`);
      }
    }
```

- [ ] **Step 3: Verify the script compiles**

Run: `cd /Users/philipsmith/commandpost && npx tsx scripts/sms-alerts.ts 2>&1 | head -3`
Expected: Shows "Usage: npx tsx scripts/sms-alerts.ts --morning"

- [ ] **Step 4: Commit**

```bash
git add scripts/sms-alerts.ts
git commit -m "feat: add AI-powered weekly insights to Monday morning briefing"
```

---

### Task 7: Final verification

- [ ] **Step 1: Run full test suite**

Run: `cd /Users/philipsmith/commandpost && npm test 2>&1 | tail -20`
Expected: All tests pass (76 total: 71 existing + 5 new Claude tests).

- [ ] **Step 2: Run production build**

Run: `cd /Users/philipsmith/commandpost && npm run build 2>&1 | tail -10`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Verify all new files exist**

Run:
```bash
ls -la /Users/philipsmith/commandpost/src/lib/claude.ts \
  /Users/philipsmith/commandpost/src/lib/actions/dashboard-actions.ts \
  /Users/philipsmith/commandpost/src/components/dashboard-query.tsx \
  /Users/philipsmith/commandpost/src/components/follow-up-draft.tsx \
  /Users/philipsmith/commandpost/tests/lib/claude.test.ts
```
Expected: All 5 files exist.
