# Phase 10: Reporting & Export — Design Spec

## Goal

Add comprehensive reporting and export capabilities to CommandPost with 7 report types available in both CSV and PDF formats, accessible from a central Reports hub page and via contextual export buttons on existing pages.

## Audience

- **Owner (Philip)**: Offline review, trend tracking, tax prep
- **Clients**: Professional project/invoice summaries
- **Accountant/Bookkeeper**: Financial data exports for QuickBooks, Wave, etc.

## Architecture

All reports are generated server-side via API routes under `/api/reports/[type]`. Each route accepts query parameters for date range and format, then returns either a PDF (via react-pdf) or CSV (plain text generation) as a downloadable file. The UI has two access points: a dedicated `/reports` page with all 7 report types, and contextual export buttons embedded in existing pages.

## Report Types

### 1. Monthly P&L (PDF)
- Revenue: sum of paid invoices in period
- Expenses: sum of expenses in period, broken down by category
- Net profit and margin percentage
- Period selector: month/year

### 2. Client Revenue Summary (CSV + PDF)
- Each client's total paid invoice revenue for the period
- Sorted by revenue descending
- Includes invoice count per client
- Period selector: date range

### 3. Expense Export (CSV)
- All expenses for the period
- Columns: date, category, description, amount, client (if associated)
- Sorted by date descending
- Period selector: date range

### 4. Invoice Export (CSV)
- All invoices for the period
- Columns: invoice_number, client, status, total_amount, due_date, sent_at, paid_at, is_recurring
- Sorted by date descending
- Period selector: date range

### 5. Pipeline Report (PDF)
- Lead count and total value per stage
- Conversion rate: won / (won + lost)
- Average deal value
- Leads needing follow-up
- Top 5 leads by estimated value

### 6. Client Health Report (PDF)
- All clients with health scores
- Grouped by status: needs_attention, at_risk, healthy
- Per-client: score breakdown (payment speed, outstanding balance, engagement)
- Action items for at-risk clients

### 7. Ops Uptime Report (PDF)
- Per-endpoint: 30-day uptime %, avg response time, incident count
- Recent incidents with duration
- Overall fleet health summary

## Date Range Selection

Shared `ReportDatePicker` component with presets:
- This Month
- Last Month
- Last Quarter
- Year to Date
- Custom (date inputs)

All API routes accept `start` and `end` query params (ISO date strings).

## UI: Reports Hub Page (`/reports`)

New sidebar nav item "Reports" between "Ops" and any future items. The page displays 7 report cards in a grid layout, each with:
- Report name and short description
- Date range picker (shared state or per-card)
- Format buttons: "Download CSV" and/or "Download PDF" depending on available formats

## UI: Contextual Export Buttons

Small export buttons added to existing pages:
- **Finances > Invoices tab**: "Export CSV" button for invoice data
- **Finances > Expenses tab**: "Export CSV" button for expense data
- **Finances > Revenue tab**: "Download P&L PDF" + "Client Revenue CSV" buttons
- **Pipeline page**: "Download Pipeline Report" PDF button
- **Clients page**: "Download Health Report" PDF button + "Client Revenue CSV" button
- **Ops page**: "Download Uptime Report" PDF button

These buttons use the same API routes as the Reports hub, passing the current page's filter context as parameters.

## Shared Components

### `ReportDatePicker`
- Preset buttons + custom date inputs
- Returns `{ start: string, end: string }`
- Used on Reports page and optionally on contextual buttons (some pages already have period filters)

### `ExportButton`
- Props: label, href (API route + params), format icon (CSV/PDF)
- Shows loading spinner while download is in progress
- Triggers browser file download

## API Routes

All under `/api/reports/`:

| Route | Formats | Query Params |
|-------|---------|-------------|
| `/api/reports/pnl` | PDF | start, end |
| `/api/reports/client-revenue` | CSV, PDF | start, end |
| `/api/reports/expenses` | CSV | start, end |
| `/api/reports/invoices` | CSV | start, end |
| `/api/reports/pipeline` | PDF | (none — current snapshot) |
| `/api/reports/client-health` | PDF | (none — current snapshot) |
| `/api/reports/uptime` | PDF | (none — current snapshot) |

Format selection via `?format=pdf` or `?format=csv` query param (default: pdf where applicable).

## PDF Styling

Consistent with existing invoice PDF: clean layout, CommandPost branding header, date range in subtitle, tabular data where appropriate. Uses `@react-pdf/renderer` (already installed).

## CSV Format

Standard RFC 4180 CSV with headers. UTF-8 encoding. Filename includes report type and date range (e.g., `expenses-2026-01-01-to-2026-05-16.csv`).

## No New Dependencies

- PDF: `@react-pdf/renderer` (already installed)
- CSV: Hand-rolled string generation (simple enough, no library needed)
- Date handling: Native JS Date (already used throughout)
