# CommandPost Phase 9: Recurring Revenue & Client Health — Design Spec

**Date:** 2026-05-15
**Author:** Phil Smith + Claude
**Status:** Approved

## Overview

Add client health scoring (computed on-the-fly, no new tables), immediate and briefing-based SMS alerts for at-risk clients, and a full recurring invoice management UI with MRR tracking on the dashboard.

## Client Health Scores

### Computation

`getClientHealth(db, clientId)` in `src/lib/queries/client-queries.ts` returns `{ score: number, status: 'healthy' | 'at_risk' | 'needs_attention', payment: number, balance: number, engagement: number }`.

Score is 0-100, computed from three factors:

**Payment speed (40 points)** — Average days to pay invoices in the last 6 months:
- ≤7 days = 40
- ≤14 days = 30
- ≤30 days = 20
- >30 days = 10
- No paid invoices = 20 (neutral)

**Outstanding balance (30 points)** — Total unpaid sent invoices:
- $0 outstanding = 30
- Outstanding but none overdue = 15
- Any overdue = 0

**Engagement (30 points)** — Days since last activity log entry:
- ≤7 days = 30
- ≤14 days = 25
- ≤30 days = 15
- ≤60 days = 5
- >60 days = 0

**Thresholds:**
- ≥70 = `healthy`
- 40–69 = `at_risk`
- <40 = `needs_attention`

### Batch Function

`getClientHealthSummary(db)` returns health data for all active, non-deleted clients. Used by the dashboard and alert scripts.

### UI Changes

**Client detail page** (`src/app/(dashboard)/clients/[id]/page.tsx`):
- Health score badge below client info showing score number + colored status label
- Breakdown showing payment, balance, and engagement sub-scores

**Dashboard** (`src/app/(dashboard)/page.tsx`):
- At-risk and needs-attention clients appear in the action items list
- `needs_attention` = red, `at_risk` = yellow
- Each links to the client detail page

**Clients list page** (`src/app/(dashboard)/clients/page.tsx`):
- Health indicator dot (green/yellow/red) next to each client name

### Component

`src/components/client-health-badge.tsx` — Reusable component displaying the health score with colored status. Used on both the client detail and client list pages.

## Client Health Alerts

### Immediate Alert

In `scripts/health-check.ts`, after the endpoint health checks complete, compute client health for all active clients via `getClientHealthSummary`. If any client has `needs_attention` status and no `client_health_warning` alert has been sent for that client in the last 7 days (checked via `hasAlertBeenSent` with `reference_id` = client ID), send an SMS: `ALERT: [Client Name] needs attention — health score [X]/100`.

New alert type: `client_health_warning`.

Uses the existing alert deduplication pattern — `hasAlertBeenSent(db, 'client_health_warning', clientId)` with a 7-day lookback (new parameter or separate query checking `sent_at >= date('now', '-7 days')`).

### Monday Briefing

In `scripts/sms-alerts.ts`, inside the `isMonday` block after the pipeline summary, add a client health summary line if any clients are at risk or need attention. E.g., "Client health: 2 at risk, 1 needs attention."

### Dashboard Action Items

`getActionItems` in `src/lib/queries/dashboard-queries.ts` gains new items:
- `needs_attention` clients: red urgency, title = "[Client Name] — health [X]/100", link = `/clients/[id]`
- `at_risk` clients: yellow urgency, title = "[Client Name] — health [X]/100", link = `/clients/[id]`

## Recurring Invoice Management

### New Queries

In `src/lib/queries/invoice-queries.ts`:

- `getRecurringInvoices(db)` — All invoices where `is_recurring = 1` with client name joined. Returns id, invoice_number, client_id, client_name, total_amount, recurrence_day, status.
- `getMrr(db)` — `SELECT COALESCE(SUM(total_amount), 0) FROM invoices WHERE is_recurring = 1`. Returns a number.
- `getClientRecurringInvoices(db, clientId)` — Recurring invoices for a specific client.

### Server Actions

In `src/lib/actions/invoice-actions.ts`:

- `toggleRecurring(formData)` — Takes `id`. Flips `is_recurring` between 0 and 1 on the invoice. Revalidates the invoice detail and finances paths.
- `updateRecurrenceDay(formData)` — Takes `id` and `day` (1-28). Updates `recurrence_day`. Revalidates paths.
- `createRecurringInvoice(formData)` — Takes `client_id`, `recurrence_day`, and line items (description[], quantity[], unit_price[]). Creates a new invoice with `is_recurring = 1`, `recurrence_day` set, and status = `draft`. Revalidates paths.

### Client Detail Page

`src/app/(dashboard)/clients/[id]/page.tsx` — New section between client info and projects:
- Shows the client's recurring invoices (from `getClientRecurringInvoices`)
- Each shows: invoice number, amount, recurrence day, next due date
- "Set Up Recurring Invoice" button linking to a form/modal for creating a new recurring invoice for this client

### Recurring Invoice Form

`src/components/recurring-invoice-form.tsx` — Client component for creating a new recurring invoice:
- Client ID passed as prop (pre-selected)
- Recurrence day picker (1-28)
- Line items: description, quantity, unit price (add/remove rows)
- Submit calls `createRecurringInvoice` server action

### Finances Page — Recurring Tab

`src/app/(dashboard)/finances/page.tsx` — New "Recurring" tab alongside existing tabs:

Summary stats at top:
- MRR (monthly recurring revenue)
- Number of active recurring invoices
- Next upcoming generation date (earliest recurrence_day in the future)

Table listing all recurring invoice templates:
- Invoice number, client name, amount, recurrence day, status
- Each row links to the invoice detail page
- Toggle to activate/deactivate recurrence (calls `toggleRecurring`)

### Invoice Detail Page

`src/app/(dashboard)/finances/invoices/[id]/page.tsx` — When viewing a recurring invoice:
- Show recurrence info: day of month, active/inactive status
- Toggle button to activate/deactivate recurrence
- Inline control to edit recurrence day (1-28)

### Dashboard MRR Stat

`src/app/(dashboard)/page.tsx` — Add MRR to the summary stats grid. Uses `getMrr(db)`. Displayed as a dollar amount alongside existing stats (Active Clients, Monthly Revenue, etc.).

## File Structure

```
src/
  lib/
    queries/
      client-queries.ts                  # MODIFY: add getClientHealth, getClientHealthSummary
      invoice-queries.ts                 # MODIFY: add getRecurringInvoices, getMrr, getClientRecurringInvoices
      dashboard-queries.ts               # MODIFY: add client health items to getActionItems
    actions/
      invoice-actions.ts                 # MODIFY: add toggleRecurring, updateRecurrenceDay, createRecurringInvoice
  app/
    (dashboard)/
      page.tsx                           # MODIFY: add MRR stat, client health action items
      clients/
        page.tsx                         # MODIFY: add health indicator dots
        [id]/page.tsx                    # MODIFY: add health badge, recurring invoices section
      finances/
        page.tsx                         # MODIFY: add Recurring tab
        invoices/[id]/page.tsx           # MODIFY: add recurrence controls
  components/
    client-health-badge.tsx              # CREATE: reusable health score display
    recurring-invoice-form.tsx           # CREATE: form for creating recurring invoices
scripts/
  health-check.ts                        # MODIFY: add client health alerting
  sms-alerts.ts                          # MODIFY: add client health to Monday briefing
tests/
  queries/
    client-health.test.ts               # CREATE: test health score computation
    recurring-invoices.test.ts           # CREATE: test recurring invoice queries
```

## Dependencies

No new npm dependencies.
