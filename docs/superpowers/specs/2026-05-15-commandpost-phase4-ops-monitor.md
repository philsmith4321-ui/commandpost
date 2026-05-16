# CommandPost Phase 4: Ops Monitor — Design Spec

**Date:** 2026-05-15
**Author:** Phil Smith + Claude
**Status:** Approved

## Overview

Add an Ops Monitor module to CommandPost for HTTP health checking of deployed apps/servers. A cron script pings endpoints on configurable intervals, tracks response times, detects downtime (2 consecutive failures), and records incidents. The `/ops` page shows status at a glance; the dashboard surfaces down servers as red action items. No SMS alerts (Phase 5). No disk monitoring (deferred).

## Database Schema

### endpoints

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| name | TEXT NOT NULL | Display name (e.g., "Paul Winkler AI") |
| url | TEXT NOT NULL | Full URL to check (e.g., `http://165.227.185.182/api/v1/health`) |
| check_interval_seconds | INTEGER NOT NULL DEFAULT 300 | Default 5 minutes |
| slow_threshold_ms | INTEGER NOT NULL DEFAULT 5000 | Response time above this = slow |
| is_active | INTEGER NOT NULL DEFAULT 1 | 0 or 1 |
| created_at | TEXT NOT NULL DEFAULT (datetime('now')) | |

### health_checks

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| endpoint_id | INTEGER FK → endpoints(id) ON DELETE CASCADE | |
| status_code | INTEGER | Nullable — null if connection failed entirely |
| response_time_ms | INTEGER NOT NULL | |
| is_healthy | INTEGER NOT NULL | 0 or 1. Healthy = status 2xx and connection succeeded |
| checked_at | TEXT NOT NULL DEFAULT (datetime('now')) | |

### incidents

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| endpoint_id | INTEGER FK → endpoints(id) ON DELETE CASCADE | |
| started_at | TEXT NOT NULL DEFAULT (datetime('now')) | |
| resolved_at | TEXT | Null while incident is ongoing |
| duration_seconds | INTEGER | Computed on resolution |

## Pre-Seeded Endpoints

On first run (if endpoints table is empty), seed these:

| Name | URL |
|------|-----|
| Paul Winkler AI | `http://165.227.185.182/api/v1/health` |
| GrantCraft AI | `https://147.182.217.191` |
| Zerona Content Engine | `https://159.89.91.177/health` |
| CommandPost | `http://localhost:3004` |

## Health Check Logic

### Cron Script: `scripts/health-check.ts`

Run via system cron every minute (`* * * * *`). The script manages per-endpoint intervals internally.

**Per endpoint (if active and enough time since last check):**

1. HTTP GET the URL with a 10-second timeout
2. Record in `health_checks`: status_code (null if connection error), response_time_ms, is_healthy (true if status 2xx)
3. **Down detection:** Query last 2 health checks for this endpoint. If both `is_healthy = 0` AND no open incident exists (no row with `resolved_at IS NULL`), create a new incident.
4. **Recovery:** If `is_healthy = 1` AND an open incident exists, resolve it: set `resolved_at = datetime('now')`, compute `duration_seconds`.

**Data retention:** After all checks complete, delete health_check rows older than 30 days.

### npm script

```json
"cron:health": "npx tsx scripts/health-check.ts"
```

## Ops Page UI

### Status List — `/ops`

- Table: status dot (green/red/yellow), name, URL, response time, last checked timestamp, uptime % (30 days)
- Green = healthy (last check is_healthy = 1, no open incident)
- Red = down (open incident)
- Yellow = slow (healthy but response_time_ms > slow_threshold_ms)
- "+ Add Endpoint" button

### Endpoint Detail — `/ops/[id]`

- Header: name, URL, status dot, current response time
- Stats cards:
  - Uptime % (30 days): `healthy checks / total checks * 100`
  - Avg response time (24 hours)
  - Total incidents (all time)
- Response time chart: last 24 hours, CSS-based bar/line chart (same approach as revenue chart — no chart library)
- Incident history: table with started_at, resolved_at, duration. Sorted newest first.
- Actions: Edit, Delete

### New Endpoint — `/ops/new`

- Form: name, URL, check interval (seconds, default 300), slow threshold (ms, default 5000), active checkbox
- Save creates endpoint

### Edit Endpoint — `/ops/[id]/edit`

- Same form, pre-filled. Only accessible from detail page.

## Dashboard Integration

### Summary Card

Add to the dashboard summary cards grid:
- **Servers:** "All OK" in green, or red count of down endpoints (e.g., "2 down")

### Action Items

Open incidents appear as red action items:
- Type: `server_down`
- Title: "DOWN: [name] since [started_at]"
- Link: `/ops/[id]`
- Urgency: `red`

### Alert Bar

Down servers appear in the alert bar as red alerts.

## Navigation

The sidebar already has an "Ops" link. It currently points to `/ops`. No changes needed.

## File Structure

```
src/
├── lib/
│   ├── db.ts                                    # MODIFY: add endpoints, health_checks, incidents tables
│   ├── types.ts                                 # MODIFY: add Endpoint, HealthCheck, Incident interfaces
│   ├── queries/
│   │   ├── endpoint-queries.ts                  # CREATE: endpoint CRUD
│   │   ├── health-check-queries.ts              # CREATE: health check recording, stats, uptime
│   │   ├── incident-queries.ts                  # CREATE: incident CRUD, open/resolve
│   │   └── dashboard-queries.ts                 # MODIFY: add server_down action items + summary stat
│   └── actions/
│       └── endpoint-actions.ts                  # CREATE: endpoint server actions
├── components/
│   ├── status-dot.tsx                           # CREATE: green/red/yellow dot component
│   └── response-time-chart.tsx                  # CREATE: CSS-based 24h response time chart
├── app/
│   ├── (dashboard)/
│   │   ├── ops/
│   │   │   ├── page.tsx                         # CREATE: ops status list page
│   │   │   ├── new/
│   │   │   │   └── page.tsx                     # CREATE: new endpoint page
│   │   │   └── [id]/
│   │   │       ├── page.tsx                     # CREATE: endpoint detail page
│   │   │       └── edit/
│   │   │           └── page.tsx                 # CREATE: edit endpoint page
│   │   └── page.tsx                             # MODIFY: add server stats to dashboard
scripts/
├── health-check.ts                              # CREATE: cron health check script
└── seed-endpoints.ts                            # CREATE: seed pre-loaded endpoints
tests/
└── queries/
    ├── endpoint-queries.test.ts                 # CREATE
    ├── health-check-queries.test.ts             # CREATE
    ├── incident-queries.test.ts                 # CREATE
    └── dashboard-queries.test.ts                # MODIFY: add server_down tests
```

## Dependencies

No new dependencies. Uses Node's built-in `fetch` for HTTP requests (available in Node 18+).
