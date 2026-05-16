# CommandPost Phase 7: AI-Powered Features — Design Spec

**Date:** 2026-05-15
**Author:** Phil Smith + Claude
**Status:** Approved

## Overview

Add three Claude-powered features to CommandPost: (1) a natural language query widget on the dashboard, (2) AI-generated follow-up drafts for leads, and (3) weekly business insights appended to the Monday morning SMS. All gated behind `ANTHROPIC_API_KEY` env var — the app works fine without it.

## Environment Variable

```
ANTHROPIC_API_KEY=sk-ant-...
```

## Claude Utility

### `src/lib/claude.ts`

- `isClaudeConfigured()`: Returns true if `ANTHROPIC_API_KEY` is set.
- `askClaude(systemPrompt: string, userMessage: string, maxTokens?: number)`: POST to `https://api.anthropic.com/v1/messages` with:
  - Header: `x-api-key`, `anthropic-version: 2023-06-01`, `content-type: application/json`
  - Body: `model: "claude-sonnet-4-20250514"`, `max_tokens` (default 1024), `system`, `messages: [{ role: "user", content: userMessage }]`
  - Returns the text content from the first content block
  - Returns `null` on failure (logs error, does not throw)

No new npm dependencies. Uses Node built-in `fetch`.

## Feature 1: Natural Language Query

### How It Works

Two-step process:
1. User types a question (e.g., "which clients owe me money?")
2. Server action sends the question to Claude with the database schema as context. Claude responds with a SQLite SELECT query.
3. Server action validates the query is read-only (rejects INSERT/UPDATE/DELETE/DROP/ALTER/CREATE), executes it against the DB, collects results.
4. Server action sends the results back to Claude with the original question, asking for a formatted natural language answer.
5. Answer displayed on the dashboard.

### Server Action

#### `src/lib/actions/dashboard-actions.ts`

`askDashboardQuestion(formData: FormData)`: Takes `question` field.

**Step 1 — Generate SQL:**

System prompt:
```
You are a SQL assistant for a business management app. Given a user's question, write a SQLite SELECT query to answer it. Return ONLY the SQL query, no explanation.

Database schema:
[full schema of all tables with column names and types]
```

**Step 2 — Validate SQL:**

Before execution, check that the response:
- Contains only one statement (no semicolons except at the end)
- Starts with SELECT (case-insensitive, after trimming)
- Does not contain INSERT, UPDATE, DELETE, DROP, ALTER, CREATE (case-insensitive word boundary check)

Strip markdown code fences (```sql ... ```) if Claude wraps the response. If validation fails, return an error message to the user.

**Step 3 — Execute SQL:**

Run the query with `db.prepare(sql).all()`. Wrap in try/catch — if the query fails, return a friendly error.

**Step 4 — Format answer:**

System prompt:
```
You are a helpful business assistant. Given a user's question and the database query results, provide a clear, concise answer. Use specific numbers. Keep it to 2-3 sentences.
```

User message: `Question: [original question]\n\nQuery results: [JSON.stringify(results)]`

Returns `{ answer: string }` or `{ error: string }`.

### Dashboard UI Changes

#### `src/app/(dashboard)/page.tsx`

Add a query widget at the top of the dashboard (below the greeting, above the alert bar). Only rendered when Claude is configured.

#### `src/components/dashboard-query.tsx`

Client component (`'use client'`). Contains:
- Text input with placeholder "Ask about your business..."
- Submit button
- Loading state (spinner/disabled)
- Answer display area (shows the formatted answer or error)
- Clears answer when a new question is submitted

Uses `useActionState` (React 19) to call `askDashboardQuestion`.

## Feature 2: Lead Follow-up Drafts

### Server Action

#### `src/lib/actions/lead-actions.ts`

Add `generateFollowUp(formData: FormData)`: Takes `id` field (lead ID).

Gathers context:
- Lead details from `getLeadById`: business_name, contact_person, email, stage, estimated_value, source
- All lead notes from `getLeadNotes` in chronological order
- Stage history from `getStageHistory`
- Days since the most recent note

System prompt:
```
You are a business development assistant for a web development freelancer. Generate a follow-up for a potential client.

Provide:
1. EMAIL_SUBJECT: A concise email subject line
2. EMAIL_BODY: A professional, personalized follow-up email (3-5 paragraphs)
3. TALKING_POINTS: 3-4 bullet points for a phone call alternative

Base your tone and content on the lead's stage, history, and how long since last contact. Be warm but professional. Reference specific details from the notes when relevant.
```

User message: formatted context string with all lead details.

Parse the response to extract `email_subject`, `email_body`, and `talking_points` (array of strings). Use simple text parsing — Claude's response will follow the labeled format.

Returns `{ email_subject: string, email_body: string, talking_points: string[] }` or `{ error: string }`.

### UI Changes

#### `src/components/follow-up-draft.tsx`

Client component. Contains:
- "Draft Follow-up" button (styled like other action buttons)
- Loading state
- Result card with:
  - Email subject in a header
  - Email body in a pre-formatted copyable block with a "Copy" button
  - Talking points as a bullet list
- Hidden when Claude is not configured

#### `src/app/(dashboard)/pipeline/[id]/page.tsx`

Import and render `FollowUpDraft` component on the lead detail page, passing the lead ID. Place it after the existing lead info section and before the notes section.

Pass `isClaudeConfigured` as a prop (computed server-side) so the component can hide itself without a client-side check.

## Feature 3: Weekly Insights in Monday SMS

### Changes to `scripts/sms-alerts.ts`

Inside the `morningBriefing` function, in the `if (isMonday)` block, after the existing pipeline summary line:

1. Check `isClaudeConfigured()`. If not configured, skip (existing behavior preserved).
2. Gather business data:
   - Revenue this month vs. last 2 months (from `getMonthlyRevenue` or direct query)
   - Revenue by client (from `getRevenueByClient`)
   - Leads stuck in stages 7+ days (direct query on leads + stage history)
   - Expense total this month vs. last month
   - Average days to invoice payment (paid invoices from last 90 days)
3. Send to Claude with system prompt:
   ```
   You are a business analyst. Given this week's business data, provide 2-3 brief, actionable insights. Each insight must be one sentence. Focus on trends, risks, and opportunities. Be specific with numbers. Keep total response under 280 characters.
   ```
4. Append Claude's response to the Monday SMS parts: `Insights: [response]`

Max tokens: 200 (keeps the SMS addition short).

### Helper Function

`getWeeklyInsightsData(db)` in `scripts/sms-alerts.ts` (local function, not exported): Gathers the business data listed above and returns it as a formatted string for the Claude prompt.

## File Structure

```
src/
  lib/
    claude.ts                                # CREATE: Claude API utility
    actions/
      dashboard-actions.ts                   # CREATE: askDashboardQuestion
      lead-actions.ts                        # MODIFY: add generateFollowUp
  app/
    (dashboard)/
      page.tsx                               # MODIFY: add query widget
      pipeline/[id]/page.tsx                 # MODIFY: add follow-up draft component
  components/
    dashboard-query.tsx                      # CREATE: natural language query widget
    follow-up-draft.tsx                      # CREATE: lead follow-up draft UI
scripts/
  sms-alerts.ts                              # MODIFY: add weekly insights
tests/
  lib/
    claude.test.ts                           # CREATE: test isClaudeConfigured + askClaude mock
```

## Dependencies

No new dependencies. Uses Node's built-in `fetch` for Claude API calls.
