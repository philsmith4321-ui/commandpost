# Phase 12: Email & Notifications — Design Spec

## Goal

Add a dual-channel notification system: in-app notifications (bell icon + dedicated page) and email alerts (immediate for critical events, daily digest for informational, user-configurable per type). Uses Resend for email delivery.

## Data Model

### New Table: `notifications`

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Auto-increment |
| type | TEXT NOT NULL | Event type |
| title | TEXT NOT NULL | Short display title |
| message | TEXT | Longer detail text |
| link | TEXT | URL to navigate to on click |
| is_read | INTEGER NOT NULL DEFAULT 0 | Read/unread state |
| created_at | TEXT NOT NULL DEFAULT (datetime('now')) | |

### New Table: `notification_preferences`

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Auto-increment |
| notification_type | TEXT NOT NULL UNIQUE | Event type |
| email_delivery | TEXT NOT NULL DEFAULT 'digest' | 'immediate', 'digest', or 'none' |

### Notification Types

| Type | Default Email | Forced? |
|------|--------------|---------|
| server_down | immediate | Yes (always immediate) |
| server_recovered | immediate | Yes (always immediate) |
| client_health_critical | immediate | Yes (always immediate) |
| invoice_overdue | digest | No |
| invoice_paid | digest | No |
| deliverable_overdue | digest | No |
| follow_up_due | digest | No |
| lead_stage_changed | digest | No |
| time_invoiced | none | No |

### Environment Variables

- `RESEND_API_KEY` — Resend API key for sending emails
- `NOTIFICATION_FROM_EMAIL` — Sender address (e.g. `alerts@commandpost.rekindleleads.com`)
- `NOTIFICATION_TO_EMAIL` — Recipient address (Philip's email)
- `CRON_SECRET` — Shared secret to authenticate cron API calls

## Email Implementation

### Resend Integration

Single module `src/lib/email.ts` exporting `sendEmail(to, subject, html)`. Uses Resend REST API via `fetch` (no SDK). Gracefully no-ops if `RESEND_API_KEY` is unset (logs warning, does not throw).

### Email Templates

Plain HTML builder functions (no external template library):
- `buildAlertEmail(title, message, link)` — Single alert email for immediate notifications
- `buildDigestEmail(items: {title, message, link, type}[])` — Daily digest with all items grouped by type

### Notification Creation

`createNotification(db, type, title, message, link)`:
1. Inserts row into `notifications` table
2. Checks `notification_preferences` for the type's `email_delivery` setting
3. If type is forced-immediate (server_down, server_recovered, client_health_critical) or preference is 'immediate': sends email immediately
4. If preference is 'digest': no action (cron picks it up)
5. If preference is 'none': no action

## Cron Endpoints

### `POST /api/cron/notifications` — Every 15 minutes

Checks for event conditions and creates notifications (if not already created today):
- Invoices that became overdue today
- Deliverables that became overdue today
- Leads with follow_up_date = today or past (not already notified)
- Clients whose health dropped to needs_attention (not already notified in last 7 days)

Protected by `CRON_SECRET` header validation.

### `POST /api/cron/digest` — Daily at 6:30 AM

1. Collects all notifications from the last 24 hours where type's preference is 'digest'
2. If no items, skips sending
3. Builds digest email with items grouped by type
4. Sends via Resend
5. Records in `alerts_sent` table with type 'morning_briefing'

Protected by `CRON_SECRET` header validation.

## UI: Bell Icon (Sidebar)

- Positioned in the sidebar, shows numeric badge when unread count > 0
- Click opens a dropdown panel showing 10 most recent notifications
- Each item shows: colored type indicator, title, relative time ("2h ago")
- Unread items have a blue dot
- "Mark all read" button at top of dropdown
- "View all" link navigates to `/notifications`

## UI: `/notifications` Page

New sidebar nav item "Notifications" (or accessible via bell "View all").

- **Filters**: Type dropdown, read/unread toggle, date range inputs
- **Notification list**: Each row shows type badge, title, message preview, timestamp, read state
- **Click behavior**: Marks as read, navigates to the notification's `link`
- **Bulk action**: "Mark all as read" button

## UI: `/settings/notifications` Page

New page for managing email preferences.

- Table of all notification types
- Each row: type name (human-readable), current email_delivery setting as dropdown
- Forced types (server_down, server_recovered, client_health_critical): shows "Immediate (required)" with no dropdown
- Configurable types: dropdown with options "Immediate", "Digest", "None"
- Changes save immediately via server action (no submit button needed)

## Integration Points

Notifications are created from these existing code paths:

| Event | Trigger Location | Notes |
|-------|-----------------|-------|
| server_down | Ops monitoring cron (existing) | Add createNotification next to recordAlert |
| server_recovered | Ops monitoring cron (existing) | Same |
| client_health_critical | Health recalculation | When score drops to needs_attention |
| invoice_overdue | `/api/cron/notifications` | Daily check |
| invoice_paid | `markInvoicePaidAction` | Inline in action |
| deliverable_overdue | `/api/cron/notifications` | Daily check |
| follow_up_due | `/api/cron/notifications` | Daily check |
| lead_stage_changed | `updateLeadStageAction` | Inline in action |
| time_invoiced | `generateInvoiceFromTimeAction` | Inline in action |

## Server Actions

- `markNotificationRead(id)` — Sets is_read = 1
- `markAllNotificationsRead()` — Sets all is_read = 1
- `updateNotificationPreference(type, emailDelivery)` — Updates preference

## Queries

- `getUnreadCount(db)` — Count of unread notifications
- `getRecentNotifications(db, limit)` — Most recent N notifications
- `getNotificationsFiltered(db, filters)` — With type/read/date filters
- `getNotificationPreferences(db)` — All preferences (with defaults for missing types)
- `getDigestNotifications(db)` — Unread notifications from last 24h with digest preference

## Cron Setup on Server

Two cron entries on the DigitalOcean server:

```
*/15 * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" -X POST http://localhost:3004/api/cron/notifications
30 6 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" -X POST http://localhost:3004/api/cron/digest
```

## No New Dependencies

All built with existing stack: better-sqlite3, Next.js server actions, React server components, native `fetch` for Resend REST API.
