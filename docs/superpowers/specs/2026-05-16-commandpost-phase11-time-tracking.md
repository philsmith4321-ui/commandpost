# Phase 11: Time Tracking — Design Spec

## Goal

Add time tracking per deliverable with per-project hourly rates, manual entry, and the ability to auto-generate invoices from uninvoiced time entries.

## Data Model

### New Table: `time_entries`

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Auto-increment |
| project_id | INTEGER NOT NULL | FK to projects |
| deliverable_id | INTEGER | FK to deliverables, nullable (for project-level time) |
| description | TEXT | Optional note beyond the deliverable title |
| duration_minutes | INTEGER NOT NULL | Duration in minutes |
| entry_date | TEXT NOT NULL | Date the work was done (YYYY-MM-DD) |
| hourly_rate | REAL NOT NULL | Rate for this entry (defaults from project) |
| is_invoiced | INTEGER NOT NULL DEFAULT 0 | Whether this entry has been billed |
| invoice_id | INTEGER | FK to invoices, nullable (set when invoiced) |
| created_at | TEXT NOT NULL DEFAULT (datetime('now')) | |

### Modified Table: `projects`

Add column: `hourly_rate REAL` — nullable, used as default rate for time entries on this project.

## Time Entry Flow

- User logs time against a deliverable (or directly against a project if no deliverable)
- Required fields: duration (hours + minutes), entry_date
- Optional: description (additional context beyond the deliverable title)
- Hourly rate auto-fills from the project's `hourly_rate` but can be overridden per entry
- Once an entry is included in an invoice, `is_invoiced` = 1 and `invoice_id` is set

## UI: Time Entry Form

Located on the **project detail page** beneath the deliverables list:
- Deliverable dropdown (optional — lists deliverables for this project)
- Duration inputs: hours (number) + minutes (number)
- Date input (defaults to today)
- Description text input (optional)
- Rate input (pre-filled from project hourly_rate)
- Submit button "Log Time"

## UI: Project Page Enhancements

- **Hourly Rate setting**: Editable field on the project page (or edit page)
- **Time Summary card**: Total hours logged, total cost, uninvoiced hours, uninvoiced amount
- **Recent Time Entries table**: date, deliverable, duration, rate, amount, invoiced status
- **"Generate Invoice" button**: Visible when uninvoiced time exists

## UI: Finances Time Tab

New tab "Time" added to the Finances page tabs (after Recurring):
- **Stats row**: Hours This Month, Uninvoiced Total ($), Uninvoiced Hours
- **Filters**: Client dropdown, project dropdown, date range, invoiced/uninvoiced toggle
- **Time entries table**: Date, Client, Project, Deliverable, Duration, Rate, Amount, Status
- **Bulk "Generate Invoice" button**: Select a client, generates invoice from all their uninvoiced entries

## UI: Dashboard Enhancement

- Add "Uninvoiced Time" metric to the home dashboard stats (only shown if uninvoiced amount > 0)
- Shows dollar amount of unbilled time

## UI: Deliverable Display

- Each deliverable in the project's deliverable list shows total hours logged next to it (e.g., "3.5h")

## Invoice Generation from Time Entries

When "Generate Invoice" is triggered:
1. Collect all uninvoiced `time_entries` for the selected client (or project)
2. Group entries: each becomes an invoice line item
   - Description: `[Deliverable title] — [entry description]` (or just deliverable title if no description)
   - Quantity: duration in hours (duration_minutes / 60, rounded to 2 decimal places)
   - Unit price: the entry's hourly_rate
   - Amount: quantity × unit_price
3. Create a new invoice (status: draft) with these line items
4. Mark all included entries as `is_invoiced = 1` and set their `invoice_id`
5. Redirect to the new invoice's detail page

## Server Actions

- `createTimeEntry(projectId, deliverableId?, durationMinutes, entryDate, description?, hourlyRate)` — creates entry
- `deleteTimeEntry(id)` — removes entry (only if not invoiced)
- `generateInvoiceFromTime(clientId, entryIds[])` — creates invoice from selected entries
- `updateProjectRate(projectId, hourlyRate)` — sets project default rate

## Queries

- `getTimeEntriesByProject(db, projectId)` — all entries for a project
- `getTimeEntriesByClient(db, clientId)` — all entries across client's projects
- `getUninvoicedByClient(db, clientId)` — uninvoiced entries for a client
- `getUninvoicedByProject(db, projectId)` — uninvoiced entries for a project
- `getTimeStats(db)` — hours this month, uninvoiced total, uninvoiced hours
- `getTimeEntriesFiltered(db, filters)` — for the Time tab with client/project/date/status filters
- `getProjectTimeSummary(db, projectId)` — total hours, total cost, uninvoiced hours, uninvoiced cost
- `getDeliverableHours(db, projectId)` — hours per deliverable for display

## No New Dependencies

All built with existing stack: better-sqlite3, Next.js server actions, React server components.
