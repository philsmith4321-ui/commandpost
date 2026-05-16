# CommandPost Phase 5: SMS Alerts — Design Spec

**Date:** 2026-05-15
**Author:** Phil Smith + Claude
**Status:** Approved

## Overview

Add Twilio-based SMS alerts to CommandPost. Immediate alerts fire when servers go down or recover (baked into the existing health check cron). A daily morning briefing at 7 AM Central batches all items needing attention into one text. Monday briefings include a pipeline summary; 1st-of-month briefings include a financial summary. All SMS is gated behind env vars — the app works fine without Twilio configured.

## Database Schema

### alerts_sent

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| alert_type | TEXT NOT NULL | `server_down`, `server_recovered`, `morning_briefing` |
| reference_id | INTEGER | Nullable. For server alerts, the incident id. Prevents duplicate alerts. |
| message | TEXT NOT NULL | Full message text sent |
| sent_at | TEXT NOT NULL DEFAULT (datetime('now')) | |

## Environment Variables

```
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=+1XXXXXXXXXX
ALERT_TO_NUMBER=+1XXXXXXXXXX
```

## Twilio Utility

### `src/lib/twilio.ts`

- `isTwilioConfigured()`: Returns true if all 4 env vars are set.
- `sendSms(message: string)`: POST to `https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json` with basic auth (SID:AuthToken), body `From`, `To`, `Body`. Uses Node built-in `fetch`. Returns success/failure boolean.

No new npm dependencies. Twilio's REST API is a simple POST with basic auth.

## Immediate Alerts (Health Check Integration)

### Modify: `scripts/health-check.ts`

After creating an incident (server down):
1. Check `alerts_sent` for an existing `server_down` alert with `reference_id = incident.id`. If found, skip.
2. Send SMS: `"ALERT: [name] is down. Last healthy: [time]"`
3. Record in `alerts_sent` with `alert_type = 'server_down'`, `reference_id = incident.id`.

After resolving an incident (server recovered):
1. Send SMS: `"RECOVERED: [name] is back up. Downtime: [duration]"`
2. Record in `alerts_sent` with `alert_type = 'server_recovered'`, `reference_id = incident.id`.

Both gated behind `isTwilioConfigured()`. If not configured, skip silently.

### Duration formatting

Same `formatDuration` helper as the ops detail page: `< 60s` → "Xs", `< 1h` → "Xm", else "Xh Ym".

## Morning Briefing

### Script: `scripts/sms-alerts.ts --morning`

Run via system cron at `0 12 * * *` (12:00 UTC = 7:00 AM Central).

**Gathers items from existing query functions:**
- Overdue deliverables (from `getActionItems` or direct query)
- Deliverables due within 3 days
- Missed lead follow-ups
- Overdue invoices
- Down servers (open incidents)

**Monday addition (day of week check):**
- Pipeline summary: lead count, total pipeline value, follow-ups needed (from `getDashboardSummary`)

**1st-of-month addition (date check):**
- Previous month's financial summary: revenue, expenses, profit, outstanding invoices (from `getFinanceSummary` or direct query)

**Message format:**
```
Good morning. X items need attention: (1) Overdue: [title] (2) Follow up: [name] (3) Invoice [number] overdue. Pipeline: X leads worth $Y, Z need follow-up. Open CommandPost for details.
```

**Skipped** if no items need attention AND it's not Monday AND it's not the 1st.

**Logged** to `alerts_sent` with `alert_type = 'morning_briefing'`.

### npm script

```json
"cron:alerts": "npx tsx scripts/sms-alerts.ts --morning"
```

## Alert Queries

### `src/lib/queries/alert-queries.ts`

- `recordAlert(db, { alert_type, reference_id, message })`: Insert into alerts_sent.
- `hasAlertBeenSent(db, alert_type, reference_id)`: Check if alert already sent for this reference.
- `listRecentAlerts(db, limit)`: Last N alerts sent, for debugging/display.

## File Structure

```
src/
  lib/
    db.ts                                    # MODIFY: add alerts_sent table
    types.ts                                 # MODIFY: add AlertSent interface
    twilio.ts                                # CREATE: Twilio utility
    queries/
      alert-queries.ts                       # CREATE: alert recording and dedup
  app/
    (dashboard)/
      page.tsx                               # NO CHANGES (alerts are SMS-only)
scripts/
  health-check.ts                            # MODIFY: add immediate SMS alerts
  sms-alerts.ts                              # CREATE: morning briefing script
tests/
  queries/
    alert-queries.test.ts                    # CREATE
  lib/
    twilio.test.ts                           # CREATE: test isTwilioConfigured + sendSms mock
```

## Dependencies

No new dependencies. Uses Node's built-in `fetch` for Twilio API calls.
