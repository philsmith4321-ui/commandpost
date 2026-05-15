# CommandPost — Design Spec

**Date:** 2026-05-15
**Author:** Phil Smith + Claude
**Status:** Approved

## Overview

CommandPost is a personal business management web app — a single command center for managing clients, projects, sales pipeline, finances, and server operations. It replaces scattered spreadsheets, tribal knowledge, and manual monitoring with one unified tool.

**Primary user:** Phil Smith (single user).

**Core UX principle:** Morning briefing + proactive alerts. The app tells you what needs attention rather than requiring you to go looking.

## Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Database:** SQLite with WAL mode (single file)
- **SMS:** Twilio API
- **Payments:** Stripe API (invoice payment links + payment status sync)
- **AI:** Anthropic SDK (Claude) — reserved for future features
- **Deployment:** DigitalOcean droplet, Nginx reverse proxy, PM2 process manager
- **Auth:** Single-user password login (hashed, stored in env)

## UI Layout

- **Sidebar navigation** (left) with module icons and labels. Collapsible.
- **Mobile:** Sidebar collapses to a bottom navigation bar.
- **Top area:** Alert banner when critical items exist (server down, overdue invoice). Hidden when clear.
- **Main content area:** Module content.
- **Responsive:** Mobile-friendly throughout. All views usable on phone.

## Module 1: Dashboard (Morning Briefing)

The home screen. Read-only roll-up from all modules. No data entry on this page.

### Sections (top to bottom):

1. **Alert Bar** — Red/yellow banner at top for critical items (server down, overdue invoice, missed follow-up). Hidden when everything is fine.

2. **Today's Summary** — Card grid:
   - Active clients count + any with overdue deliverables
   - Revenue this month vs. last month
   - Open leads in pipeline + any needing follow-up today
   - Server health (all green, or which ones are down)

3. **Action Items** — Prioritized list of things needing attention today:
   - Overdue or approaching deliverables
   - Leads needing follow-up
   - Overdue invoices
   - Each item links directly to the relevant record

4. **Recent Activity** — Chronological feed (last 7 days):
   - New leads, paid invoices, health check incidents, notes added
   - Scrollable list

## Module 2: Clients & Projects

### Clients List View
- Table/card view: name, status (active/paused/completed), monthly value, last activity date
- Search and filter by status

### Client Detail Page
- **Info card:** Company name, contact person, email, phone, notes, acquisition source
- **Projects list:** Each client can have multiple projects
- **Financial summary:** Total invoiced, total paid, outstanding balance (from Finances module)
- **Activity log:** Timestamped notes (calls, emails, decisions)

### Project Detail
- Project name, status (active/on-hold/completed), start date
- **Deliverables:** Checklist items with due dates and status (not started / in progress / delivered)
- **Tech details:** Server IP, repo URL, deploy command, stack notes
- **Notes:** Free-form decision/change log

### Behaviors
- Deliverable due date approaching (3 days out) or overdue → Dashboard action item + SMS alert
- Adding a note auto-updates client "last activity" timestamp
- Marking client "completed" cascades to all active projects

## Module 3: Pipeline (Lead Tracking & Sales)

### Pipeline Board View (Kanban)
- Columns: **New → Contacted → Discovery Call → Proposal Sent → Negotiating → Won / Lost**
- Drag-and-drop between columns
- Each card: business name, contact name, estimated value, days in current stage
- Visual aging: yellow at 5 days in stage, red at 10 days

### Lead Detail Page
- Business name, contact person, email, phone, website
- Acquisition source (referral, website, outbound, other)
- Estimated deal value
- Current stage + full stage history with timestamps
- **Follow-up date:** Next action date. Drives SMS alerts and dashboard items.
- **Notes log:** Timestamped interaction entries

### Lead Sources
- Tag on each lead for acquisition channel
- Dashboard can surface patterns (e.g., "3 of last 5 wins from referrals")

### Behaviors
- Follow-up date passes without a new note → SMS alert + dashboard action item
- Moving to "Won" → prompt to create Client record (pre-fills from lead data)
- Moving to "Lost" → asks for reason (too expensive / competitor / timing / ghosted)
- Weekly SMS summary on Mondays: lead count, total pipeline value, follow-ups needed

## Module 4: Finances

### Invoices
- Create invoices tied to a client: line items, amounts, due date
- Status: **Draft → Sent → Paid → Overdue**
- Stripe integration: generate payment link per invoice
- Auto-sync payment status from Stripe API
- PDF generation for manual sending
- **Recurring invoices:** For retainer clients, auto-generate new invoice on a set day each month (created 7 days before due date for review)

### Revenue Dashboard
- Monthly revenue bar chart (last 12 months)
- Revenue by client breakdown
- MRR (monthly recurring revenue) vs. one-time project revenue
- Year-to-date total

### Expenses
- Simple entry: date, amount, category, description, client (optional)
- Categories: **Servers/Hosting, Software/APIs, Contractor, Marketing, Other**
- Tie expenses to clients for profitability tracking
- Monthly total + comparison to revenue

### Profitability per Client
- Table: Client | Revenue | Expenses | Profit | Margin %

### Behaviors
- Invoice overdue by 3+ days → SMS alert + dashboard action item
- Monthly SMS on 1st: revenue, expenses, profit, outstanding invoices

## Module 5: Ops Monitor

### Monitored Endpoints
- List of servers/apps: name, URL/IP, health check endpoint, check interval
- Pre-loaded:
  - Paul Winkler AI — `http://165.227.185.182/api/v1/health`
  - GrantCraft AI — `https://147.182.217.191`
  - Zerona Content Engine — `https://159.89.91.177/health`
  - CommandPost (self-monitoring)
- Add/remove endpoints via UI

### Health Check Logic
- Background job pings each endpoint on interval (default: 5 minutes)
- Tracks: HTTP status code, response time, last successful check
- **Down:** 2 consecutive failures (avoids false alarms)
- **Slow:** Response time > 5 seconds (configurable per endpoint)

### Disk Monitoring (Optional)
- Lightweight agent script installable on each droplet
- Reports disk usage to CommandPost
- SMS when disk > 80%

### Ops Page (Minimal)
- Status list: green/red/yellow dots per endpoint
- Click into endpoint: uptime % (30 days), response time graph, incident history
- This page is rarely visited — SMS alerts are the real product

### Safety Net
- External free service (UptimeRobot) monitors CommandPost itself — the one endpoint this app can't self-monitor

## SMS Alert Strategy

**Provider:** Twilio API. One phone number. ~$1.50/month + fractions of a cent per text.

### Immediate Alerts (any time)
| Trigger | Message |
|---------|---------|
| Server down (2 consecutive failures) | "ALERT: [name] is down. Last healthy: [time]" |
| Server recovered | "RECOVERED: [name] is back up. Downtime: [duration]" |
| Disk usage > 80% | "WARNING: [name] disk at [X]%" |

### Morning Briefing (7 AM daily, batched)
Non-urgent items batched into one SMS:
- Deliverables due within 3 days
- Overdue deliverables
- Missed lead follow-ups
- Overdue invoices

Format: "Good morning. X items need attention: (1) [item] (2) [item]. Open CommandPost for details."

Skipped if nothing needs attention.

### Scheduled Summaries
| Schedule | Content |
|----------|---------|
| Monday AM | Pipeline: X leads worth $Y, Z need follow-up |
| 1st of month | Monthly: $X revenue, $Y expenses, $Z profit. X invoices outstanding |

## Database Schema

Single SQLite file. All dates stored as ISO 8601 strings. Soft deletes via `deleted_at` column where relevant.

### Tables

**clients**
- id, name, contact_person, email, phone, notes, source, status (active/paused/completed), monthly_value, created_at, updated_at, deleted_at

**projects**
- id, client_id (FK), name, status (active/on-hold/completed), start_date, server_ip, repo_url, deploy_command, stack_notes, created_at, updated_at

**deliverables**
- id, project_id (FK), title, status (not_started/in_progress/delivered), due_date, completed_at, created_at

**activity_logs**
- id, client_id (FK), project_id (FK, nullable), content, created_at

**leads**
- id, business_name, contact_person, email, phone, website, source (referral/website/outbound/other), estimated_value, stage (new/contacted/discovery/proposal/negotiating/won/lost), lost_reason, follow_up_date, created_at, updated_at, converted_client_id (FK, nullable)

**lead_stage_history**
- id, lead_id (FK), stage, entered_at

**lead_notes**
- id, lead_id (FK), content, created_at

**invoices**
- id, client_id (FK), invoice_number, status (draft/sent/paid/overdue), due_date, sent_at, paid_at, stripe_payment_link, stripe_payment_id, is_recurring, recurrence_day, total_amount, created_at

**invoice_items**
- id, invoice_id (FK), description, quantity, unit_price, amount

**expenses**
- id, client_id (FK, nullable), category (servers/software/contractor/marketing/other), description, amount, expense_date, created_at

**endpoints**
- id, name, url, health_check_path, check_interval_seconds, slow_threshold_ms, is_active, created_at

**health_checks**
- id, endpoint_id (FK), status_code, response_time_ms, is_healthy, checked_at

**incidents**
- id, endpoint_id (FK), started_at, resolved_at, duration_seconds

**alerts_sent**
- id, alert_type, message, sent_at

## Build Order

1. **Foundation** — Project scaffolding, auth, layout (sidebar + mobile nav), SQLite setup, base styles
2. **Clients & Projects** — Full CRUD, deliverables, activity logs, tech details
3. **Dashboard** — Morning briefing pulling from Clients data (expanded as modules are added)
4. **Pipeline** — Kanban board, lead CRUD, follow-up tracking, Won→Client conversion
5. **Finances** — Invoice CRUD, Stripe integration, revenue dashboard, expenses, profitability
6. **Ops Monitor** — Endpoint CRUD, background health checks, incident tracking
7. **SMS Alerts** — Twilio integration, immediate alerts, morning briefing batch, scheduled summaries
8. **Polish** — Mobile optimization, PDF invoice generation, disk monitoring agent
