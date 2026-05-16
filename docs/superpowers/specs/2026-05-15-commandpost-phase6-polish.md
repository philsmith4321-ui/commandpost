# CommandPost Phase 6: Polish — Design Spec

**Date:** 2026-05-15
**Author:** Phil Smith + Claude
**Status:** Approved

## Overview

Two-part polish phase: (1) targeted CSS fixes to improve mobile usability, and (2) a disk monitoring agent that lets remote servers report disk usage to CommandPost, with SMS alerts when disks get full.

## Part 1: Mobile Polish

CSS-only changes. No new components, no structural changes.

### 1. Reduce page padding

Every dashboard page uses `p-6` on the outer wrapper. Change to `p-4 sm:p-6` so phones get 16px padding instead of 24px.

**Files to modify:**
- `src/app/(dashboard)/page.tsx`
- `src/app/(dashboard)/clients/page.tsx`
- `src/app/(dashboard)/clients/new/page.tsx`
- `src/app/(dashboard)/clients/[id]/page.tsx`
- `src/app/(dashboard)/clients/[id]/edit/page.tsx`
- `src/app/(dashboard)/clients/[id]/projects/new/page.tsx`
- `src/app/(dashboard)/clients/[id]/projects/[projectId]/page.tsx`
- `src/app/(dashboard)/clients/[id]/projects/[projectId]/edit/page.tsx`
- `src/app/(dashboard)/pipeline/page.tsx`
- `src/app/(dashboard)/pipeline/new/page.tsx`
- `src/app/(dashboard)/pipeline/[id]/page.tsx`
- `src/app/(dashboard)/pipeline/[id]/edit/page.tsx`
- `src/app/(dashboard)/finances/page.tsx`
- `src/app/(dashboard)/finances/invoices/new/page.tsx`
- `src/app/(dashboard)/finances/invoices/[id]/page.tsx`
- `src/app/(dashboard)/finances/invoices/[id]/edit/page.tsx`
- `src/app/(dashboard)/ops/page.tsx`
- `src/app/(dashboard)/ops/new/page.tsx`
- `src/app/(dashboard)/ops/[id]/page.tsx`
- `src/app/(dashboard)/ops/[id]/edit/page.tsx`

### 2. Dashboard summary cards grid

Change `grid-cols-2 md:grid-cols-5` to `grid-cols-2 sm:grid-cols-3 md:grid-cols-5`.

**File:** `src/app/(dashboard)/page.tsx`

### 3. Endpoint detail header wrapping

The status dot + name + URL sit in one flex row. On mobile the URL overflows. Make the URL `block sm:inline` so it drops below the name on small screens.

**File:** `src/app/(dashboard)/ops/[id]/page.tsx`

### 4. Ops detail stats cards

Change `grid-cols-3` to `grid-cols-1 sm:grid-cols-3` so cards stack on phones.

**File:** `src/app/(dashboard)/ops/[id]/page.tsx`

### 5. Kanban scroll hint

Add a gradient fade on the right edge of the kanban board on small screens to indicate horizontal scrollability. Use a pseudo-element or wrapper with `mask-image` / gradient overlay. Only visible below `sm` breakpoint.

**File:** `src/components/kanban-board.tsx` (wrap in a container with the gradient)

## Part 2: Disk Monitoring Agent

### Database Schema

#### disk_reports

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| endpoint_id | INTEGER NOT NULL | FK to endpoints |
| mount_point | TEXT NOT NULL | e.g. `/`, `/data` |
| total_gb | REAL NOT NULL | Total disk size |
| used_gb | REAL NOT NULL | Used disk space |
| percent_used | REAL NOT NULL | Usage percentage |
| reported_at | TEXT NOT NULL DEFAULT (datetime('now')) | |

### Environment Variable

```
DISK_REPORT_API_KEY=some-secret-key
```

Gated: if not set, the API endpoint returns 503. App works fine without it.

### API Endpoint

`POST /api/disk-report?key=SECRET_KEY`

**Request body:**
```json
{
  "endpoint_name": "commandpost.superpowers.dev",
  "disks": [
    { "mount": "/", "total_gb": 50, "used_gb": 42, "percent_used": 84.0 },
    { "mount": "/data", "total_gb": 200, "used_gb": 185, "percent_used": 92.5 }
  ]
}
```

**Logic:**
1. Validate API key from query param against `DISK_REPORT_API_KEY` env var. 401 if wrong, 503 if not configured.
2. Look up endpoint by `endpoint_name` matching `endpoints.name`. 404 if not found.
3. Insert one `disk_reports` row per disk entry.
4. For any disk exceeding 85%: check `alerts_sent` for existing `disk_warning` alert with `reference_id = endpoint_id` where `sent_at >= date('now')` (UTC today). If none, send SMS via Twilio: `"DISK WARNING: [endpoint_name] [mount] at [percent]% ([used]GB / [total]GB)"`. Record in `alerts_sent` with `alert_type = 'disk_warning'`, `reference_id = endpoint_id`.
5. Delete `disk_reports` older than 30 days.
6. Return 200 with `{ "ok": true }`.

### Alert Type

Add `'disk_warning'` to the `AlertType` union in `src/lib/types.ts`.

### Disk Report Queries

#### `src/lib/queries/disk-report-queries.ts`

- `recordDiskReport(db, { endpoint_id, mount_point, total_gb, used_gb, percent_used })`: Insert into disk_reports.
- `getLatestDiskReports(db, endpoint_id)`: Get the most recent report for each mount point for an endpoint.
- `deleteOldDiskReports(db)`: Delete reports older than 30 days.

### Ops Detail Page Changes

#### `src/app/(dashboard)/ops/[id]/page.tsx`

Below the response time chart, add a "Disk Usage" section. Only shown if disk reports exist for the endpoint. For each mount point, show:
- Mount point name
- A horizontal bar colored green (<70%), yellow (70-85%), or red (>85%)
- Text: `42.0 / 50.0 GB (84.0%)`
- Last reported timestamp

### Disk Usage Bar Component

#### `src/components/disk-usage-bar.tsx`

A simple component that renders a colored bar given `percent_used`, `used_gb`, `total_gb`, and `mount_point`. Uses CSS width percentage. Same pattern as the response time chart — pure CSS, no JS charting library.

### Bash Agent Script

#### `scripts/disk-report.sh`

~20-line bash script. Reads `df -B1` (bytes for precision), converts to GB, formats JSON, POSTs to CommandPost.

**Usage:**
```bash
./disk-report.sh https://commandpost.example.com YOUR_API_KEY
```

**Behavior:**
- Filters to real filesystems (excludes tmpfs, devtmpfs, etc.)
- Hostname is derived from the server's hostname or passed as a third optional arg
- Uses `curl` to POST JSON
- Exits 0 on success, 1 on failure

Meant to run via cron on each remote server, e.g. `0 * * * *` (hourly).

### Morning Briefing Integration

The existing morning briefing in `scripts/sms-alerts.ts` should include disk warnings if any endpoint has a disk above 85% based on the latest reports.

## File Structure

```
src/
  lib/
    db.ts                                    # MODIFY: add disk_reports table
    types.ts                                 # MODIFY: add disk_warning to AlertType, DiskReport interface
    queries/
      disk-report-queries.ts                 # CREATE
  app/
    api/
      disk-report/
        route.ts                             # CREATE
    (dashboard)/
      page.tsx                               # MODIFY: grid fix
      clients/
        page.tsx                             # MODIFY: padding
        new/page.tsx                         # MODIFY: padding
        [id]/page.tsx                        # MODIFY: padding
        [id]/edit/page.tsx                   # MODIFY: padding
        [id]/projects/new/page.tsx           # MODIFY: padding
        [id]/projects/[projectId]/page.tsx   # MODIFY: padding
        [id]/projects/[projectId]/edit/page.tsx # MODIFY: padding
      pipeline/
        page.tsx                             # MODIFY: padding
        new/page.tsx                         # MODIFY: padding
        [id]/page.tsx                        # MODIFY: padding
        [id]/edit/page.tsx                   # MODIFY: padding
      finances/
        page.tsx                             # MODIFY: padding
        invoices/new/page.tsx                # MODIFY: padding
        invoices/[id]/page.tsx               # MODIFY: padding
        invoices/[id]/edit/page.tsx          # MODIFY: padding
      ops/
        page.tsx                             # MODIFY: padding
        new/page.tsx                         # MODIFY: padding
        [id]/page.tsx                        # MODIFY: padding, stats grid, header wrap, disk section
        [id]/edit/page.tsx                   # MODIFY: padding
  components/
    kanban-board.tsx                          # MODIFY: scroll hint
    disk-usage-bar.tsx                        # CREATE
scripts/
  sms-alerts.ts                              # MODIFY: include disk warnings in morning briefing
  disk-report.sh                             # CREATE
tests/
  queries/
    disk-report-queries.test.ts              # CREATE
  api/
    disk-report.test.ts                      # CREATE
```

## Dependencies

No new dependencies.
