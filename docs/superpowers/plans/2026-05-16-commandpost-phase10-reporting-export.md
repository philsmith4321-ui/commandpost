# Phase 10: Reporting & Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 7 downloadable report types (CSV + PDF) accessible from a central Reports hub page and contextual export buttons on existing pages.

**Architecture:** Server-side API routes under `/api/reports/[type]` generate CSV or PDF on demand. A new `/reports` dashboard page provides a central hub with date range pickers and download buttons. Contextual export buttons are added to existing finances, pipeline, clients, and ops pages. PDF generation uses the existing `@react-pdf/renderer` library. CSV is hand-rolled string generation.

**Tech Stack:** Next.js 16 (App Router), better-sqlite3, @react-pdf/renderer, Vitest, Tailwind CSS v4 (dark theme)

---

## File Structure

### New Files
- `src/lib/queries/report-queries.ts` — All report data-fetching functions (date-range filtered)
- `src/lib/reports/csv.ts` — CSV string generation utilities
- `src/lib/reports/pdf-styles.ts` — Shared PDF styles for all report documents
- `src/lib/reports/pnl-pdf.ts` — P&L PDF document builder
- `src/lib/reports/client-revenue-pdf.ts` — Client revenue PDF document builder
- `src/lib/reports/pipeline-pdf.ts` — Pipeline report PDF document builder
- `src/lib/reports/client-health-pdf.ts` — Client health report PDF document builder
- `src/lib/reports/uptime-pdf.ts` — Ops uptime report PDF document builder
- `src/app/api/reports/pnl/route.ts` — P&L PDF endpoint
- `src/app/api/reports/client-revenue/route.ts` — Client revenue CSV/PDF endpoint
- `src/app/api/reports/expenses/route.ts` — Expense CSV endpoint
- `src/app/api/reports/invoices/route.ts` — Invoice CSV endpoint
- `src/app/api/reports/pipeline/route.ts` — Pipeline PDF endpoint
- `src/app/api/reports/client-health/route.ts` — Client health PDF endpoint
- `src/app/api/reports/uptime/route.ts` — Uptime PDF endpoint
- `src/components/export-button.tsx` — Reusable download button component
- `src/components/report-date-picker.tsx` — Date range picker with presets
- `src/app/(dashboard)/reports/page.tsx` — Reports hub page
- `tests/queries/report-queries.test.ts` — Tests for report query functions
- `tests/reports/csv.test.ts` — Tests for CSV generation
- `tests/reports/pdf.test.ts` — Tests for PDF document builders

### Modified Files
- `src/components/sidebar.tsx` — Add "Reports" nav item
- `src/components/mobile-nav.tsx` — Add "Reports" nav item
- `src/app/(dashboard)/finances/page.tsx` — Add contextual export buttons
- `src/app/(dashboard)/pipeline/page.tsx` — Add pipeline report export button
- `src/app/(dashboard)/clients/page.tsx` — Add health report + client revenue export buttons
- `src/app/(dashboard)/ops/page.tsx` — Add uptime report export button

---

## Task 1: Report Query Functions

**Files:**
- Create: `src/lib/queries/report-queries.ts`
- Test: `tests/queries/report-queries.test.ts`

- [ ] **Step 1: Write failing tests for report queries**

Create `tests/queries/report-queries.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initDb } from '@/lib/db';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-report-queries.db');

describe('report queries', () => {
  let db: Database.Database;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    db = initDb(TEST_DB_PATH);
    db.prepare("INSERT INTO clients (name, status) VALUES (?, ?)").run('Client A', 'active');
    db.prepare("INSERT INTO clients (name, status) VALUES (?, ?)").run('Client B', 'active');
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('getPnlData returns revenue, expenses by category, and profit for a date range', async () => {
    const { getPnlData } = await import('@/lib/queries/report-queries');
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, paid_at, total_amount) VALUES (?, ?, ?, ?, ?, ?)").run(1, 'INV-0001', 'paid', '2026-05-01', '2026-05-02', 5000);
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, paid_at, total_amount) VALUES (?, ?, ?, ?, ?, ?)").run(1, 'INV-0002', 'paid', '2026-04-01', '2026-04-05', 2000);
    db.prepare("INSERT INTO expenses (client_id, category, description, amount, expense_date) VALUES (?, ?, ?, ?, ?)").run(1, 'servers', 'Hosting', 500, '2026-05-10');
    db.prepare("INSERT INTO expenses (client_id, category, description, amount, expense_date) VALUES (?, ?, ?, ?, ?)").run(null, 'software', 'License', 300, '2026-05-15');
    db.prepare("INSERT INTO expenses (client_id, category, description, amount, expense_date) VALUES (?, ?, ?, ?, ?)").run(null, 'other', 'Outside range', 100, '2026-04-01');

    const data = getPnlData(db, '2026-05-01', '2026-05-31');
    expect(data.revenue).toBe(5000);
    expect(data.totalExpenses).toBe(800);
    expect(data.profit).toBe(4200);
    expect(data.expensesByCategory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'servers', amount: 500 }),
        expect.objectContaining({ category: 'software', amount: 300 }),
      ])
    );
  });

  it('getClientRevenueData returns per-client revenue sorted descending', async () => {
    const { getClientRevenueData } = await import('@/lib/queries/report-queries');
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, paid_at, total_amount) VALUES (?, ?, ?, ?, ?, ?)").run(1, 'INV-0001', 'paid', '2026-05-01', '2026-05-02', 5000);
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, paid_at, total_amount) VALUES (?, ?, ?, ?, ?, ?)").run(1, 'INV-0002', 'paid', '2026-05-10', '2026-05-11', 1000);
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, paid_at, total_amount) VALUES (?, ?, ?, ?, ?, ?)").run(2, 'INV-0003', 'paid', '2026-05-05', '2026-05-06', 3000);

    const data = getClientRevenueData(db, '2026-05-01', '2026-05-31');
    expect(data).toHaveLength(2);
    expect(data[0].client_name).toBe('Client A');
    expect(data[0].revenue).toBe(6000);
    expect(data[0].invoice_count).toBe(2);
    expect(data[1].client_name).toBe('Client B');
    expect(data[1].revenue).toBe(3000);
    expect(data[1].invoice_count).toBe(1);
  });

  it('getExpenseExportData returns expenses in date range with client names', async () => {
    const { getExpenseExportData } = await import('@/lib/queries/report-queries');
    db.prepare("INSERT INTO expenses (client_id, category, description, amount, expense_date) VALUES (?, ?, ?, ?, ?)").run(1, 'servers', 'Hosting', 500, '2026-05-10');
    db.prepare("INSERT INTO expenses (client_id, category, description, amount, expense_date) VALUES (?, ?, ?, ?, ?)").run(null, 'software', 'License', 300, '2026-05-15');
    db.prepare("INSERT INTO expenses (client_id, category, description, amount, expense_date) VALUES (?, ?, ?, ?, ?)").run(null, 'other', 'Old', 100, '2026-03-01');

    const data = getExpenseExportData(db, '2026-05-01', '2026-05-31');
    expect(data).toHaveLength(2);
    expect(data[0].expense_date).toBe('2026-05-15');
    expect(data[0].client_name).toBeNull();
    expect(data[1].client_name).toBe('Client A');
  });

  it('getInvoiceExportData returns invoices in date range', async () => {
    const { getInvoiceExportData } = await import('@/lib/queries/report-queries');
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, total_amount, is_recurring, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(1, 'INV-0001', 'paid', '2026-05-01', 5000, 0, '2026-05-01');
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, total_amount, is_recurring, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(2, 'INV-0002', 'sent', '2026-05-15', 2000, 1, '2026-05-10');
    db.prepare("INSERT INTO invoices (client_id, invoice_number, status, due_date, total_amount, is_recurring, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(1, 'INV-0003', 'draft', '2026-03-01', 1000, 0, '2026-03-01');

    const data = getInvoiceExportData(db, '2026-05-01', '2026-05-31');
    expect(data).toHaveLength(2);
    expect(data[0].invoice_number).toBe('INV-0002');
    expect(data[1].invoice_number).toBe('INV-0001');
  });

  it('getPipelineReportData returns stage counts, conversion rate, and top leads', async () => {
    const { getPipelineReportData } = await import('@/lib/queries/report-queries');
    db.prepare("INSERT INTO leads (business_name, source, stage, estimated_value) VALUES (?, ?, ?, ?)").run('Lead A', 'referral', 'proposal', 10000);
    db.prepare("INSERT INTO leads (business_name, source, stage, estimated_value) VALUES (?, ?, ?, ?)").run('Lead B', 'website', 'new', 5000);
    db.prepare("INSERT INTO leads (business_name, source, stage, estimated_value, follow_up_date) VALUES (?, ?, ?, ?, ?)").run('Lead C', 'outbound', 'contacted', 8000, '2026-01-01');
    db.prepare("INSERT INTO leads (business_name, source, stage, estimated_value) VALUES (?, ?, ?, ?)").run('Won Lead', 'referral', 'won', 15000);
    db.prepare("INSERT INTO leads (business_name, source, stage, estimated_value, lost_reason) VALUES (?, ?, ?, ?, ?)").run('Lost Lead', 'other', 'lost', 3000, 'ghosted');

    const data = getPipelineReportData(db);
    expect(data.totalActiveLeads).toBe(3);
    expect(data.totalActiveValue).toBe(23000);
    expect(data.conversionRate).toBeCloseTo(50); // 1 won / (1 won + 1 lost) * 100
    expect(data.needsFollowUp).toBe(1);
    expect(data.stageBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stage: 'new', count: 1, value: 5000 }),
        expect.objectContaining({ stage: 'proposal', count: 1, value: 10000 }),
      ])
    );
    expect(data.topLeads).toHaveLength(3);
    expect(data.topLeads[0].business_name).toBe('Lead A');
  });

  it('getUptimeReportData returns per-endpoint uptime and incident counts', async () => {
    const { getUptimeReportData } = await import('@/lib/queries/report-queries');
    db.prepare("INSERT INTO endpoints (name, url, check_interval_seconds, slow_threshold_ms, is_active) VALUES (?, ?, ?, ?, ?)").run('API', 'https://api.example.com', 300, 5000, 1);
    db.prepare("INSERT INTO health_checks (endpoint_id, status_code, response_time_ms, is_healthy) VALUES (?, ?, ?, ?)").run(1, 200, 150, 1);
    db.prepare("INSERT INTO health_checks (endpoint_id, status_code, response_time_ms, is_healthy) VALUES (?, ?, ?, ?)").run(1, 200, 250, 1);
    db.prepare("INSERT INTO incidents (endpoint_id, started_at, resolved_at, duration_seconds) VALUES (?, ?, ?, ?)").run(1, '2026-05-01 10:00:00', '2026-05-01 10:05:00', 300);

    const data = getUptimeReportData(db);
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe('API');
    expect(data[0].uptime_percent).toBe(100);
    expect(data[0].avg_response_ms).toBe(200);
    expect(data[0].incident_count).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/philipsmith/commandpost && npx vitest run tests/queries/report-queries.test.ts`
Expected: FAIL — module `@/lib/queries/report-queries` not found

- [ ] **Step 3: Implement report query functions**

Create `src/lib/queries/report-queries.ts`:

```typescript
import type Database from 'better-sqlite3';

export interface PnlData {
  revenue: number;
  totalExpenses: number;
  profit: number;
  expensesByCategory: { category: string; amount: number }[];
}

export interface ClientRevenueRow {
  client_name: string;
  revenue: number;
  invoice_count: number;
}

export interface ExpenseExportRow {
  expense_date: string;
  category: string;
  description: string;
  amount: number;
  client_name: string | null;
}

export interface InvoiceExportRow {
  invoice_number: string;
  client_name: string;
  status: string;
  total_amount: number;
  due_date: string;
  sent_at: string | null;
  paid_at: string | null;
  is_recurring: number;
}

export interface PipelineReportData {
  totalActiveLeads: number;
  totalActiveValue: number;
  conversionRate: number;
  averageDealValue: number;
  needsFollowUp: number;
  stageBreakdown: { stage: string; count: number; value: number }[];
  topLeads: { business_name: string; stage: string; estimated_value: number }[];
}

export interface UptimeReportRow {
  name: string;
  url: string;
  uptime_percent: number;
  avg_response_ms: number;
  incident_count: number;
  recent_incidents: { started_at: string; resolved_at: string | null; duration_seconds: number | null }[];
}

export function getPnlData(db: Database.Database, start: string, end: string): PnlData {
  const revenue = (db.prepare(
    "SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'paid' AND paid_at >= ? AND paid_at <= ?"
  ).get(start, end) as any).total;

  const expenseRows = db.prepare(
    "SELECT category, SUM(amount) as amount FROM expenses WHERE expense_date >= ? AND expense_date <= ? GROUP BY category ORDER BY amount DESC"
  ).all(start, end) as { category: string; amount: number }[];

  const totalExpenses = expenseRows.reduce((sum, r) => sum + r.amount, 0);

  return {
    revenue,
    totalExpenses,
    profit: revenue - totalExpenses,
    expensesByCategory: expenseRows,
  };
}

export function getClientRevenueData(db: Database.Database, start: string, end: string): ClientRevenueRow[] {
  return db.prepare(`
    SELECT c.name as client_name, COALESCE(SUM(i.total_amount), 0) as revenue, COUNT(i.id) as invoice_count
    FROM invoices i JOIN clients c ON i.client_id = c.id
    WHERE i.status = 'paid' AND i.paid_at >= ? AND i.paid_at <= ? AND c.deleted_at IS NULL
    GROUP BY c.id
    ORDER BY revenue DESC
  `).all(start, end) as ClientRevenueRow[];
}

export function getExpenseExportData(db: Database.Database, start: string, end: string): ExpenseExportRow[] {
  return db.prepare(`
    SELECT e.expense_date, e.category, e.description, e.amount, c.name as client_name
    FROM expenses e LEFT JOIN clients c ON e.client_id = c.id
    WHERE e.expense_date >= ? AND e.expense_date <= ?
    ORDER BY e.expense_date DESC
  `).all(start, end) as ExpenseExportRow[];
}

export function getInvoiceExportData(db: Database.Database, start: string, end: string): InvoiceExportRow[] {
  return db.prepare(`
    SELECT i.invoice_number, c.name as client_name, i.status, i.total_amount, i.due_date, i.sent_at, i.paid_at, i.is_recurring
    FROM invoices i JOIN clients c ON i.client_id = c.id
    WHERE i.created_at >= ? AND i.created_at <= ?
    ORDER BY i.created_at DESC
  `).all(start, end) as InvoiceExportRow[];
}

export function getPipelineReportData(db: Database.Database): PipelineReportData {
  const activeLeads = db.prepare(
    "SELECT * FROM leads WHERE stage NOT IN ('won', 'lost')"
  ).all() as any[];

  const totalActiveLeads = activeLeads.length;
  const totalActiveValue = activeLeads.reduce((sum: number, l: any) => sum + (l.estimated_value || 0), 0);

  const won = (db.prepare("SELECT COUNT(*) as count FROM leads WHERE stage = 'won'").get() as any).count;
  const lost = (db.prepare("SELECT COUNT(*) as count FROM leads WHERE stage = 'lost'").get() as any).count;
  const conversionRate = (won + lost) > 0 ? (won / (won + lost)) * 100 : 0;

  const averageDealValue = totalActiveLeads > 0 ? totalActiveValue / totalActiveLeads : 0;

  const needsFollowUp = (db.prepare(
    "SELECT COUNT(*) as count FROM leads WHERE stage NOT IN ('won','lost') AND follow_up_date < date('now')"
  ).get() as any).count;

  const stageBreakdown = db.prepare(`
    SELECT stage, COUNT(*) as count, COALESCE(SUM(estimated_value), 0) as value
    FROM leads WHERE stage NOT IN ('won', 'lost')
    GROUP BY stage ORDER BY stage
  `).all() as { stage: string; count: number; value: number }[];

  const topLeads = db.prepare(`
    SELECT business_name, stage, COALESCE(estimated_value, 0) as estimated_value
    FROM leads WHERE stage NOT IN ('won', 'lost')
    ORDER BY estimated_value DESC LIMIT 5
  `).all() as { business_name: string; stage: string; estimated_value: number }[];

  return { totalActiveLeads, totalActiveValue, conversionRate, averageDealValue, needsFollowUp, stageBreakdown, topLeads };
}

export function getUptimeReportData(db: Database.Database): UptimeReportRow[] {
  const endpoints = db.prepare("SELECT * FROM endpoints WHERE is_active = 1 ORDER BY name ASC").all() as any[];

  return endpoints.map((ep: any) => {
    const uptimeRow = db.prepare(`
      SELECT COUNT(*) as total, SUM(CASE WHEN is_healthy = 1 THEN 1 ELSE 0 END) as healthy
      FROM health_checks WHERE endpoint_id = ? AND checked_at >= datetime('now', '-30 days')
    `).get(ep.id) as { total: number; healthy: number };

    const uptime_percent = uptimeRow.total > 0 ? (uptimeRow.healthy / uptimeRow.total) * 100 : 100;

    const avgRow = db.prepare(`
      SELECT COALESCE(CAST(AVG(response_time_ms) AS INTEGER), 0) as avg_ms
      FROM health_checks WHERE endpoint_id = ? AND checked_at >= datetime('now', '-30 days')
    `).get(ep.id) as { avg_ms: number };

    const incident_count = (db.prepare(
      "SELECT COUNT(*) as count FROM incidents WHERE endpoint_id = ?"
    ).get(ep.id) as any).count;

    const recent_incidents = db.prepare(
      "SELECT started_at, resolved_at, duration_seconds FROM incidents WHERE endpoint_id = ? ORDER BY started_at DESC LIMIT 5"
    ).all(ep.id) as { started_at: string; resolved_at: string | null; duration_seconds: number | null }[];

    return {
      name: ep.name,
      url: ep.url,
      uptime_percent: Math.round(uptime_percent * 10) / 10,
      avg_response_ms: avgRow.avg_ms,
      incident_count,
      recent_incidents,
    };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/philipsmith/commandpost && npx vitest run tests/queries/report-queries.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/philipsmith/commandpost
git add src/lib/queries/report-queries.ts tests/queries/report-queries.test.ts
git commit -m "feat: add report query functions for all 7 report types

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: CSV Generation Utility

**Files:**
- Create: `src/lib/reports/csv.ts`
- Test: `tests/reports/csv.test.ts`

- [ ] **Step 1: Write failing tests for CSV generation**

Create `tests/reports/csv.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('CSV generation', () => {
  it('generates CSV string from rows with headers', async () => {
    const { generateCsv } = await import('@/lib/reports/csv');
    const headers = ['Name', 'Amount', 'Date'];
    const rows = [
      ['Client A', '5000', '2026-05-01'],
      ['Client B', '3000', '2026-05-02'],
    ];
    const csv = generateCsv(headers, rows);
    expect(csv).toBe('Name,Amount,Date\r\nClient A,5000,2026-05-01\r\nClient B,3000,2026-05-02\r\n');
  });

  it('escapes fields containing commas', async () => {
    const { generateCsv } = await import('@/lib/reports/csv');
    const csv = generateCsv(['Desc'], [['Server, hosting']]);
    expect(csv).toBe('Desc\r\n"Server, hosting"\r\n');
  });

  it('escapes fields containing double quotes', async () => {
    const { generateCsv } = await import('@/lib/reports/csv');
    const csv = generateCsv(['Desc'], [['He said "hello"']]);
    expect(csv).toBe('Desc\r\n"He said ""hello"""\r\n');
  });

  it('escapes fields containing newlines', async () => {
    const { generateCsv } = await import('@/lib/reports/csv');
    const csv = generateCsv(['Desc'], [['Line1\nLine2']]);
    expect(csv).toBe('Desc\r\n"Line1\nLine2"\r\n');
  });

  it('handles empty rows', async () => {
    const { generateCsv } = await import('@/lib/reports/csv');
    const csv = generateCsv(['A', 'B'], []);
    expect(csv).toBe('A,B\r\n');
  });

  it('creates CSV response with correct headers', async () => {
    const { csvResponse } = await import('@/lib/reports/csv');
    const response = csvResponse('Name,Amount\r\nA,100\r\n', 'test-report');
    expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="test-report.csv"');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/philipsmith/commandpost && npx vitest run tests/reports/csv.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement CSV utility**

Create `src/lib/reports/csv.ts`:

```typescript
function escapeField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

export function generateCsv(headers: string[], rows: string[][]): string {
  const lines: string[] = [];
  lines.push(headers.map(escapeField).join(','));
  for (const row of rows) {
    lines.push(row.map(escapeField).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

export function csvResponse(csvString: string, filename: string): Response {
  return new Response(csvString, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}.csv"`,
    },
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/philipsmith/commandpost && npx vitest run tests/reports/csv.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/philipsmith/commandpost
git add src/lib/reports/csv.ts tests/reports/csv.test.ts
git commit -m "feat: add CSV generation utility with RFC 4180 escaping

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Shared PDF Styles

**Files:**
- Create: `src/lib/reports/pdf-styles.ts`

- [ ] **Step 1: Create shared PDF styles**

Create `src/lib/reports/pdf-styles.ts`:

```typescript
import { StyleSheet } from '@react-pdf/renderer';

export const reportStyles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 11, color: '#666', marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  statBox: { padding: 10, backgroundColor: '#f8f8f8', borderRadius: 4, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between' },
  statLabel: { fontSize: 9, color: '#666' },
  statValue: { fontSize: 14, fontWeight: 'bold' },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ddd', paddingBottom: 4, marginBottom: 4 },
  tableHeaderText: { fontSize: 9, color: '#666', fontWeight: 'bold' },
  tableRow: { flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: '#eee' },
  tableCell: { fontSize: 9 },
  tableCellRight: { fontSize: 9, textAlign: 'right' },
  totalRow: { flexDirection: 'row', marginTop: 6, paddingTop: 6, borderTopWidth: 2, borderTopColor: '#333' },
  totalLabel: { fontWeight: 'bold', fontSize: 11 },
  totalValue: { fontWeight: 'bold', fontSize: 11, textAlign: 'right' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 8, color: '#999', textAlign: 'center' },
  green: { color: '#16a34a' },
  red: { color: '#dc2626' },
});
```

- [ ] **Step 2: Commit**

```bash
cd /Users/philipsmith/commandpost
git add src/lib/reports/pdf-styles.ts
git commit -m "feat: add shared PDF report styles

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: PDF Document Builders

**Files:**
- Create: `src/lib/reports/pnl-pdf.ts`
- Create: `src/lib/reports/client-revenue-pdf.ts`
- Create: `src/lib/reports/pipeline-pdf.ts`
- Create: `src/lib/reports/client-health-pdf.ts`
- Create: `src/lib/reports/uptime-pdf.ts`
- Test: `tests/reports/pdf.test.ts`

- [ ] **Step 1: Write tests for PDF document builders**

Create `tests/reports/pdf.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import React from 'react';

describe('PDF document builders', () => {
  it('buildPnlPdf returns a React element', async () => {
    const { buildPnlPdf } = await import('@/lib/reports/pnl-pdf');
    const doc = buildPnlPdf({
      revenue: 10000,
      totalExpenses: 3000,
      profit: 7000,
      expensesByCategory: [
        { category: 'servers', amount: 2000 },
        { category: 'software', amount: 1000 },
      ],
    }, '2026-05-01', '2026-05-31');
    expect(doc).toBeDefined();
    expect(React.isValidElement(doc)).toBe(true);
  });

  it('buildClientRevenuePdf returns a React element', async () => {
    const { buildClientRevenuePdf } = await import('@/lib/reports/client-revenue-pdf');
    const doc = buildClientRevenuePdf([
      { client_name: 'Client A', revenue: 5000, invoice_count: 3 },
    ], '2026-05-01', '2026-05-31');
    expect(React.isValidElement(doc)).toBe(true);
  });

  it('buildPipelinePdf returns a React element', async () => {
    const { buildPipelinePdf } = await import('@/lib/reports/pipeline-pdf');
    const doc = buildPipelinePdf({
      totalActiveLeads: 5,
      totalActiveValue: 50000,
      conversionRate: 40,
      averageDealValue: 10000,
      needsFollowUp: 2,
      stageBreakdown: [{ stage: 'new', count: 2, value: 20000 }],
      topLeads: [{ business_name: 'Lead A', stage: 'new', estimated_value: 10000 }],
    });
    expect(React.isValidElement(doc)).toBe(true);
  });

  it('buildClientHealthPdf returns a React element', async () => {
    const { buildClientHealthPdf } = await import('@/lib/reports/client-health-pdf');
    const doc = buildClientHealthPdf([
      { clientId: 1, clientName: 'Client A', score: 85, status: 'healthy' as const, payment: 40, balance: 30, engagement: 15 },
    ]);
    expect(React.isValidElement(doc)).toBe(true);
  });

  it('buildUptimePdf returns a React element', async () => {
    const { buildUptimePdf } = await import('@/lib/reports/uptime-pdf');
    const doc = buildUptimePdf([
      { name: 'API', url: 'https://api.example.com', uptime_percent: 99.9, avg_response_ms: 200, incident_count: 1, recent_incidents: [] },
    ]);
    expect(React.isValidElement(doc)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/philipsmith/commandpost && npx vitest run tests/reports/pdf.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement P&L PDF builder**

Create `src/lib/reports/pnl-pdf.ts`:

```typescript
import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { reportStyles as s } from './pdf-styles';
import type { PnlData } from '@/lib/queries/report-queries';

export function buildPnlPdf(data: PnlData, start: string, end: string) {
  const margin = data.revenue > 0 ? Math.round((data.profit / data.revenue) * 100) : 0;

  return React.createElement(Document, null,
    React.createElement(Page, { size: 'A4', style: s.page },
      React.createElement(Text, { style: s.title }, 'Profit & Loss Statement'),
      React.createElement(Text, { style: s.subtitle }, `${start} to ${end}`),

      React.createElement(View, { style: s.statBox },
        React.createElement(View, null,
          React.createElement(Text, { style: s.statLabel }, 'REVENUE'),
          React.createElement(Text, { style: [s.statValue, s.green] }, `$${data.revenue.toLocaleString()}`),
        ),
        React.createElement(View, null,
          React.createElement(Text, { style: s.statLabel }, 'EXPENSES'),
          React.createElement(Text, { style: [s.statValue, s.red] }, `$${data.totalExpenses.toLocaleString()}`),
        ),
        React.createElement(View, null,
          React.createElement(Text, { style: s.statLabel }, 'NET PROFIT'),
          React.createElement(Text, { style: [s.statValue, data.profit >= 0 ? s.green : s.red] }, `$${data.profit.toLocaleString()}`),
        ),
        React.createElement(View, null,
          React.createElement(Text, { style: s.statLabel }, 'MARGIN'),
          React.createElement(Text, { style: s.statValue }, `${margin}%`),
        ),
      ),

      React.createElement(Text, { style: s.sectionTitle }, 'Expenses by Category'),
      React.createElement(View, { style: s.tableHeader },
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 3 }] }, 'Category'),
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 1, textAlign: 'right' }] }, 'Amount'),
      ),
      ...data.expensesByCategory.map((row, i) =>
        React.createElement(View, { key: i, style: s.tableRow },
          React.createElement(Text, { style: [s.tableCell, { flex: 3 }] }, row.category),
          React.createElement(Text, { style: [s.tableCellRight, { flex: 1 }] }, `$${row.amount.toLocaleString()}`),
        )
      ),

      React.createElement(Text, { style: s.footer }, `Generated ${new Date().toLocaleDateString()} — CommandPost`),
    )
  );
}
```

- [ ] **Step 4: Implement Client Revenue PDF builder**

Create `src/lib/reports/client-revenue-pdf.ts`:

```typescript
import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { reportStyles as s } from './pdf-styles';
import type { ClientRevenueRow } from '@/lib/queries/report-queries';

export function buildClientRevenuePdf(data: ClientRevenueRow[], start: string, end: string) {
  const totalRevenue = data.reduce((sum, r) => sum + r.revenue, 0);
  const totalInvoices = data.reduce((sum, r) => sum + r.invoice_count, 0);

  return React.createElement(Document, null,
    React.createElement(Page, { size: 'A4', style: s.page },
      React.createElement(Text, { style: s.title }, 'Client Revenue Summary'),
      React.createElement(Text, { style: s.subtitle }, `${start} to ${end}`),

      React.createElement(View, { style: s.statBox },
        React.createElement(View, null,
          React.createElement(Text, { style: s.statLabel }, 'TOTAL REVENUE'),
          React.createElement(Text, { style: [s.statValue, s.green] }, `$${totalRevenue.toLocaleString()}`),
        ),
        React.createElement(View, null,
          React.createElement(Text, { style: s.statLabel }, 'CLIENTS'),
          React.createElement(Text, { style: s.statValue }, String(data.length)),
        ),
        React.createElement(View, null,
          React.createElement(Text, { style: s.statLabel }, 'INVOICES'),
          React.createElement(Text, { style: s.statValue }, String(totalInvoices)),
        ),
      ),

      React.createElement(View, { style: s.tableHeader },
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 3 }] }, 'Client'),
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 1, textAlign: 'right' }] }, 'Invoices'),
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 1, textAlign: 'right' }] }, 'Revenue'),
      ),
      ...data.map((row, i) =>
        React.createElement(View, { key: i, style: s.tableRow },
          React.createElement(Text, { style: [s.tableCell, { flex: 3 }] }, row.client_name),
          React.createElement(Text, { style: [s.tableCellRight, { flex: 1 }] }, String(row.invoice_count)),
          React.createElement(Text, { style: [s.tableCellRight, { flex: 1 }] }, `$${row.revenue.toLocaleString()}`),
        )
      ),
      React.createElement(View, { style: s.totalRow },
        React.createElement(Text, { style: [s.totalLabel, { flex: 3 }] }, 'Total'),
        React.createElement(Text, { style: [s.totalValue, { flex: 1 }] }, String(totalInvoices)),
        React.createElement(Text, { style: [s.totalValue, { flex: 1 }] }, `$${totalRevenue.toLocaleString()}`),
      ),

      React.createElement(Text, { style: s.footer }, `Generated ${new Date().toLocaleDateString()} — CommandPost`),
    )
  );
}
```

- [ ] **Step 5: Implement Pipeline PDF builder**

Create `src/lib/reports/pipeline-pdf.ts`:

```typescript
import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { reportStyles as s } from './pdf-styles';
import type { PipelineReportData } from '@/lib/queries/report-queries';

export function buildPipelinePdf(data: PipelineReportData) {
  return React.createElement(Document, null,
    React.createElement(Page, { size: 'A4', style: s.page },
      React.createElement(Text, { style: s.title }, 'Pipeline Report'),
      React.createElement(Text, { style: s.subtitle }, `Generated ${new Date().toLocaleDateString()}`),

      React.createElement(View, { style: s.statBox },
        React.createElement(View, null,
          React.createElement(Text, { style: s.statLabel }, 'ACTIVE LEADS'),
          React.createElement(Text, { style: s.statValue }, String(data.totalActiveLeads)),
        ),
        React.createElement(View, null,
          React.createElement(Text, { style: s.statLabel }, 'PIPELINE VALUE'),
          React.createElement(Text, { style: [s.statValue, s.green] }, `$${data.totalActiveValue.toLocaleString()}`),
        ),
        React.createElement(View, null,
          React.createElement(Text, { style: s.statLabel }, 'CONVERSION RATE'),
          React.createElement(Text, { style: s.statValue }, `${Math.round(data.conversionRate)}%`),
        ),
        React.createElement(View, null,
          React.createElement(Text, { style: s.statLabel }, 'AVG DEAL'),
          React.createElement(Text, { style: s.statValue }, `$${Math.round(data.averageDealValue).toLocaleString()}`),
        ),
      ),

      data.needsFollowUp > 0 ? React.createElement(View, { style: { marginBottom: 12, padding: 8, backgroundColor: '#fef3c7', borderRadius: 4 } },
        React.createElement(Text, { style: { fontSize: 10, color: '#92400e' } }, `${data.needsFollowUp} lead${data.needsFollowUp > 1 ? 's' : ''} need follow-up`),
      ) : null,

      React.createElement(Text, { style: s.sectionTitle }, 'By Stage'),
      React.createElement(View, { style: s.tableHeader },
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 2 }] }, 'Stage'),
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 1, textAlign: 'right' }] }, 'Leads'),
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 1, textAlign: 'right' }] }, 'Value'),
      ),
      ...data.stageBreakdown.map((row, i) =>
        React.createElement(View, { key: i, style: s.tableRow },
          React.createElement(Text, { style: [s.tableCell, { flex: 2 }] }, row.stage),
          React.createElement(Text, { style: [s.tableCellRight, { flex: 1 }] }, String(row.count)),
          React.createElement(Text, { style: [s.tableCellRight, { flex: 1 }] }, `$${row.value.toLocaleString()}`),
        )
      ),

      React.createElement(Text, { style: s.sectionTitle }, 'Top Leads by Value'),
      React.createElement(View, { style: s.tableHeader },
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 3 }] }, 'Business'),
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 1 }] }, 'Stage'),
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 1, textAlign: 'right' }] }, 'Value'),
      ),
      ...data.topLeads.map((lead, i) =>
        React.createElement(View, { key: i, style: s.tableRow },
          React.createElement(Text, { style: [s.tableCell, { flex: 3 }] }, lead.business_name),
          React.createElement(Text, { style: [s.tableCell, { flex: 1 }] }, lead.stage),
          React.createElement(Text, { style: [s.tableCellRight, { flex: 1 }] }, `$${lead.estimated_value.toLocaleString()}`),
        )
      ),

      React.createElement(Text, { style: s.footer }, `Generated ${new Date().toLocaleDateString()} — CommandPost`),
    )
  );
}
```

- [ ] **Step 6: Implement Client Health PDF builder**

Create `src/lib/reports/client-health-pdf.ts`:

```typescript
import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { reportStyles as s } from './pdf-styles';
import type { ClientHealth } from '@/lib/types';

const statusColors: Record<string, string> = {
  healthy: '#16a34a',
  at_risk: '#d97706',
  needs_attention: '#dc2626',
};

export function buildClientHealthPdf(clients: ClientHealth[]) {
  const needsAttention = clients.filter(c => c.status === 'needs_attention');
  const atRisk = clients.filter(c => c.status === 'at_risk');
  const healthy = clients.filter(c => c.status === 'healthy');

  const renderGroup = (title: string, group: ClientHealth[], color: string) => {
    if (group.length === 0) return null;
    return [
      React.createElement(Text, { key: `title-${title}`, style: [s.sectionTitle, { color }] }, `${title} (${group.length})`),
      React.createElement(View, { key: `header-${title}`, style: s.tableHeader },
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 3 }] }, 'Client'),
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 1, textAlign: 'right' }] }, 'Score'),
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 1, textAlign: 'right' }] }, 'Payment'),
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 1, textAlign: 'right' }] }, 'Balance'),
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 1, textAlign: 'right' }] }, 'Engage'),
      ),
      ...group.map((c, i) =>
        React.createElement(View, { key: `row-${title}-${i}`, style: s.tableRow },
          React.createElement(Text, { style: [s.tableCell, { flex: 3 }] }, c.clientName),
          React.createElement(Text, { style: [s.tableCellRight, { flex: 1 }] }, String(c.score)),
          React.createElement(Text, { style: [s.tableCellRight, { flex: 1 }] }, `${c.payment}/40`),
          React.createElement(Text, { style: [s.tableCellRight, { flex: 1 }] }, `${c.balance}/30`),
          React.createElement(Text, { style: [s.tableCellRight, { flex: 1 }] }, `${c.engagement}/30`),
        )
      ),
    ];
  };

  return React.createElement(Document, null,
    React.createElement(Page, { size: 'A4', style: s.page },
      React.createElement(Text, { style: s.title }, 'Client Health Report'),
      React.createElement(Text, { style: s.subtitle }, `Generated ${new Date().toLocaleDateString()} — ${clients.length} active clients`),

      React.createElement(View, { style: s.statBox },
        React.createElement(View, null,
          React.createElement(Text, { style: s.statLabel }, 'HEALTHY'),
          React.createElement(Text, { style: [s.statValue, { color: '#16a34a' }] }, String(healthy.length)),
        ),
        React.createElement(View, null,
          React.createElement(Text, { style: s.statLabel }, 'AT RISK'),
          React.createElement(Text, { style: [s.statValue, { color: '#d97706' }] }, String(atRisk.length)),
        ),
        React.createElement(View, null,
          React.createElement(Text, { style: s.statLabel }, 'NEEDS ATTENTION'),
          React.createElement(Text, { style: [s.statValue, { color: '#dc2626' }] }, String(needsAttention.length)),
        ),
      ),

      ...(renderGroup('Needs Attention', needsAttention, statusColors.needs_attention) || []),
      ...(renderGroup('At Risk', atRisk, statusColors.at_risk) || []),
      ...(renderGroup('Healthy', healthy, statusColors.healthy) || []),

      React.createElement(Text, { style: s.footer }, `Generated ${new Date().toLocaleDateString()} — CommandPost`),
    )
  );
}
```

- [ ] **Step 7: Implement Uptime PDF builder**

Create `src/lib/reports/uptime-pdf.ts`:

```typescript
import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { reportStyles as s } from './pdf-styles';
import type { UptimeReportRow } from '@/lib/queries/report-queries';

export function buildUptimePdf(data: UptimeReportRow[]) {
  const allHealthy = data.every(e => e.uptime_percent >= 99.5);

  return React.createElement(Document, null,
    React.createElement(Page, { size: 'A4', style: s.page },
      React.createElement(Text, { style: s.title }, 'Ops Uptime Report'),
      React.createElement(Text, { style: s.subtitle }, `30-day summary — Generated ${new Date().toLocaleDateString()}`),

      React.createElement(View, { style: s.statBox },
        React.createElement(View, null,
          React.createElement(Text, { style: s.statLabel }, 'ENDPOINTS'),
          React.createElement(Text, { style: s.statValue }, String(data.length)),
        ),
        React.createElement(View, null,
          React.createElement(Text, { style: s.statLabel }, 'FLEET STATUS'),
          React.createElement(Text, { style: [s.statValue, allHealthy ? s.green : s.red] }, allHealthy ? 'All Healthy' : 'Issues Detected'),
        ),
      ),

      React.createElement(Text, { style: s.sectionTitle }, 'Endpoint Summary'),
      React.createElement(View, { style: s.tableHeader },
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 2 }] }, 'Endpoint'),
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 1, textAlign: 'right' }] }, 'Uptime'),
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 1, textAlign: 'right' }] }, 'Avg Response'),
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 1, textAlign: 'right' }] }, 'Incidents'),
      ),
      ...data.map((row, i) =>
        React.createElement(View, { key: i, style: s.tableRow },
          React.createElement(Text, { style: [s.tableCell, { flex: 2 }] }, row.name),
          React.createElement(Text, { style: [s.tableCellRight, { flex: 1 }] }, `${row.uptime_percent}%`),
          React.createElement(Text, { style: [s.tableCellRight, { flex: 1 }] }, `${row.avg_response_ms}ms`),
          React.createElement(Text, { style: [s.tableCellRight, { flex: 1 }] }, String(row.incident_count)),
        )
      ),

      ...data.filter(e => e.recent_incidents.length > 0).flatMap((ep, idx) => [
        React.createElement(Text, { key: `inc-title-${idx}`, style: [s.sectionTitle, { fontSize: 11 }] }, `Recent Incidents — ${ep.name}`),
        ...ep.recent_incidents.map((inc, j) =>
          React.createElement(View, { key: `inc-${idx}-${j}`, style: s.tableRow },
            React.createElement(Text, { style: [s.tableCell, { flex: 2 }] }, inc.started_at),
            React.createElement(Text, { style: [s.tableCell, { flex: 1 }] }, inc.resolved_at ? 'Resolved' : 'Ongoing'),
            React.createElement(Text, { style: [s.tableCellRight, { flex: 1 }] }, inc.duration_seconds ? `${Math.round(inc.duration_seconds / 60)}min` : '—'),
          )
        ),
      ]),

      React.createElement(Text, { style: s.footer }, `Generated ${new Date().toLocaleDateString()} — CommandPost`),
    )
  );
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd /Users/philipsmith/commandpost && npx vitest run tests/reports/pdf.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 9: Commit**

```bash
cd /Users/philipsmith/commandpost
git add src/lib/reports/pnl-pdf.ts src/lib/reports/client-revenue-pdf.ts src/lib/reports/pipeline-pdf.ts src/lib/reports/client-health-pdf.ts src/lib/reports/uptime-pdf.ts tests/reports/pdf.test.ts
git commit -m "feat: add PDF document builders for all 5 PDF report types

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: API Routes for CSV Reports (Expenses + Invoices)

**Files:**
- Create: `src/app/api/reports/expenses/route.ts`
- Create: `src/app/api/reports/invoices/route.ts`

- [ ] **Step 1: Implement expense export API route**

Create `src/app/api/reports/expenses/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getExpenseExportData } from '@/lib/queries/report-queries';
import { generateCsv, csvResponse } from '@/lib/reports/csv';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const start = searchParams.get('start') || `${new Date().getFullYear()}-01-01`;
  const end = searchParams.get('end') || new Date().toISOString().split('T')[0];

  const db = getDb();
  const data = getExpenseExportData(db, start, end);

  const headers = ['Date', 'Category', 'Description', 'Amount', 'Client'];
  const rows = data.map(r => [
    r.expense_date,
    r.category,
    r.description,
    r.amount.toFixed(2),
    r.client_name || '',
  ]);

  const csv = generateCsv(headers, rows);
  return csvResponse(csv, `expenses-${start}-to-${end}`);
}
```

- [ ] **Step 2: Implement invoice export API route**

Create `src/app/api/reports/invoices/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getInvoiceExportData } from '@/lib/queries/report-queries';
import { generateCsv, csvResponse } from '@/lib/reports/csv';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const start = searchParams.get('start') || `${new Date().getFullYear()}-01-01`;
  const end = searchParams.get('end') || new Date().toISOString().split('T')[0];

  const db = getDb();
  const data = getInvoiceExportData(db, start, end);

  const headers = ['Invoice #', 'Client', 'Status', 'Amount', 'Due Date', 'Sent Date', 'Paid Date', 'Recurring'];
  const rows = data.map(r => [
    r.invoice_number,
    r.client_name,
    r.status,
    r.total_amount.toFixed(2),
    r.due_date,
    r.sent_at || '',
    r.paid_at || '',
    r.is_recurring ? 'Yes' : 'No',
  ]);

  const csv = generateCsv(headers, rows);
  return csvResponse(csv, `invoices-${start}-to-${end}`);
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/philipsmith/commandpost
git add src/app/api/reports/expenses/route.ts src/app/api/reports/invoices/route.ts
git commit -m "feat: add CSV export API routes for expenses and invoices

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: API Routes for PDF Reports (P&L, Client Revenue, Pipeline, Client Health, Uptime)

**Files:**
- Create: `src/app/api/reports/pnl/route.ts`
- Create: `src/app/api/reports/client-revenue/route.ts`
- Create: `src/app/api/reports/pipeline/route.ts`
- Create: `src/app/api/reports/client-health/route.ts`
- Create: `src/app/api/reports/uptime/route.ts`

- [ ] **Step 1: Implement P&L PDF API route**

Create `src/app/api/reports/pnl/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { getDb } from '@/lib/db';
import { getPnlData } from '@/lib/queries/report-queries';
import { buildPnlPdf } from '@/lib/reports/pnl-pdf';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const start = searchParams.get('start') || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;
  const end = searchParams.get('end') || new Date().toISOString().split('T')[0];

  const db = getDb();
  const data = getPnlData(db, start, end);
  const doc = buildPnlPdf(data, start, end);
  const buffer = await renderToBuffer(doc);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="pnl-${start}-to-${end}.pdf"`,
    },
  });
}
```

- [ ] **Step 2: Implement Client Revenue API route (CSV + PDF)**

Create `src/app/api/reports/client-revenue/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { getDb } from '@/lib/db';
import { getClientRevenueData } from '@/lib/queries/report-queries';
import { buildClientRevenuePdf } from '@/lib/reports/client-revenue-pdf';
import { generateCsv, csvResponse } from '@/lib/reports/csv';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const start = searchParams.get('start') || `${new Date().getFullYear()}-01-01`;
  const end = searchParams.get('end') || new Date().toISOString().split('T')[0];
  const format = searchParams.get('format') || 'pdf';

  const db = getDb();
  const data = getClientRevenueData(db, start, end);

  if (format === 'csv') {
    const headers = ['Client', 'Revenue', 'Invoices'];
    const rows = data.map(r => [r.client_name, r.revenue.toFixed(2), String(r.invoice_count)]);
    const csv = generateCsv(headers, rows);
    return csvResponse(csv, `client-revenue-${start}-to-${end}`);
  }

  const doc = buildClientRevenuePdf(data, start, end);
  const buffer = await renderToBuffer(doc);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="client-revenue-${start}-to-${end}.pdf"`,
    },
  });
}
```

- [ ] **Step 3: Implement Pipeline PDF API route**

Create `src/app/api/reports/pipeline/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { getDb } from '@/lib/db';
import { getPipelineReportData } from '@/lib/queries/report-queries';
import { buildPipelinePdf } from '@/lib/reports/pipeline-pdf';

export async function GET() {
  const db = getDb();
  const data = getPipelineReportData(db);
  const doc = buildPipelinePdf(data);
  const buffer = await renderToBuffer(doc);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="pipeline-report-${new Date().toISOString().split('T')[0]}.pdf"`,
    },
  });
}
```

- [ ] **Step 4: Implement Client Health PDF API route**

Create `src/app/api/reports/client-health/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { getDb } from '@/lib/db';
import { getClientHealthSummary } from '@/lib/queries/client-queries';
import { buildClientHealthPdf } from '@/lib/reports/client-health-pdf';

export async function GET() {
  const db = getDb();
  const clients = getClientHealthSummary(db);
  const doc = buildClientHealthPdf(clients);
  const buffer = await renderToBuffer(doc);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="client-health-${new Date().toISOString().split('T')[0]}.pdf"`,
    },
  });
}
```

- [ ] **Step 5: Implement Uptime PDF API route**

Create `src/app/api/reports/uptime/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { getDb } from '@/lib/db';
import { getUptimeReportData } from '@/lib/queries/report-queries';
import { buildUptimePdf } from '@/lib/reports/uptime-pdf';

export async function GET() {
  const db = getDb();
  const data = getUptimeReportData(db);
  const doc = buildUptimePdf(data);
  const buffer = await renderToBuffer(doc);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="uptime-report-${new Date().toISOString().split('T')[0]}.pdf"`,
    },
  });
}
```

- [ ] **Step 6: Commit**

```bash
cd /Users/philipsmith/commandpost
git add src/app/api/reports/pnl/route.ts src/app/api/reports/client-revenue/route.ts src/app/api/reports/pipeline/route.ts src/app/api/reports/client-health/route.ts src/app/api/reports/uptime/route.ts
git commit -m "feat: add PDF API routes for P&L, client revenue, pipeline, health, and uptime reports

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 7: ExportButton and ReportDatePicker Components

**Files:**
- Create: `src/components/export-button.tsx`
- Create: `src/components/report-date-picker.tsx`

- [ ] **Step 1: Create ExportButton component**

Create `src/components/export-button.tsx`:

```tsx
'use client';

import { useState } from 'react';

interface ExportButtonProps {
  href: string;
  label: string;
  format: 'csv' | 'pdf';
  small?: boolean;
}

export function ExportButton({ href, label, format, small }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const icon = format === 'csv' ? '↓' : '⬇';
  const baseClasses = small
    ? 'px-2 py-1 text-xs'
    : 'px-3 py-1.5 text-sm';

  async function handleClick() {
    setLoading(true);
    try {
      const response = await fetch(href);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = response.headers.get('Content-Disposition');
      const filename = disposition?.match(/filename="(.+)"/)?.[1] || `report.${format}`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`${baseClasses} font-medium rounded-lg transition-colors bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 border border-gray-700 disabled:opacity-50`}
    >
      {loading ? '...' : `${icon} ${label}`}
    </button>
  );
}
```

- [ ] **Step 2: Create ReportDatePicker component**

Create `src/components/report-date-picker.tsx`:

```tsx
'use client';

import { useState } from 'react';

interface ReportDatePickerProps {
  onChange: (start: string, end: string) => void;
}

function getPresetDates(preset: string): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.toISOString().split('T')[0];

  switch (preset) {
    case 'this_month': {
      const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      return { start, end: today };
    }
    case 'last_month': {
      const lm = new Date(year, month - 1, 1);
      const lmEnd = new Date(year, month, 0);
      return {
        start: lm.toISOString().split('T')[0],
        end: lmEnd.toISOString().split('T')[0],
      };
    }
    case 'last_quarter': {
      const qStart = new Date(year, month - 3, 1);
      return { start: qStart.toISOString().split('T')[0], end: today };
    }
    case 'ytd':
      return { start: `${year}-01-01`, end: today };
    default:
      return { start: `${year}-01-01`, end: today };
  }
}

export function ReportDatePicker({ onChange }: ReportDatePickerProps) {
  const defaults = getPresetDates('ytd');
  const [start, setStart] = useState(defaults.start);
  const [end, setEnd] = useState(defaults.end);
  const [active, setActive] = useState('ytd');

  function selectPreset(preset: string) {
    const dates = getPresetDates(preset);
    setStart(dates.start);
    setEnd(dates.end);
    setActive(preset);
    onChange(dates.start, dates.end);
  }

  function handleCustomChange(newStart: string, newEnd: string) {
    setStart(newStart);
    setEnd(newEnd);
    setActive('custom');
    onChange(newStart, newEnd);
  }

  const presets = [
    { key: 'this_month', label: 'This Month' },
    { key: 'last_month', label: 'Last Month' },
    { key: 'last_quarter', label: 'Last Quarter' },
    { key: 'ytd', label: 'YTD' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map(p => (
        <button
          key={p.key}
          onClick={() => selectPreset(p.key)}
          className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
            active === p.key ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          {p.label}
        </button>
      ))}
      <input
        type="date"
        value={start}
        onChange={(e) => handleCustomChange(e.target.value, end)}
        className="px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded-lg text-white"
      />
      <span className="text-gray-500 text-xs">to</span>
      <input
        type="date"
        value={end}
        onChange={(e) => handleCustomChange(start, e.target.value)}
        className="px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded-lg text-white"
      />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/philipsmith/commandpost
git add src/components/export-button.tsx src/components/report-date-picker.tsx
git commit -m "feat: add ExportButton and ReportDatePicker components

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 8: Reports Hub Page

**Files:**
- Create: `src/app/(dashboard)/reports/page.tsx`
- Modify: `src/components/sidebar.tsx`
- Modify: `src/components/mobile-nav.tsx`

- [ ] **Step 1: Create reports hub page**

Create `src/app/(dashboard)/reports/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { ReportDatePicker } from '@/components/report-date-picker';
import { ExportButton } from '@/components/export-button';

const today = new Date().toISOString().split('T')[0];
const yearStart = `${new Date().getFullYear()}-01-01`;

interface ReportCard {
  title: string;
  description: string;
  formats: { label: string; format: 'csv' | 'pdf'; route: string; useDates: boolean }[];
}

const reports: ReportCard[] = [
  {
    title: 'Monthly P&L',
    description: 'Revenue, expenses by category, net profit and margin for a period.',
    formats: [
      { label: 'Download PDF', format: 'pdf', route: '/api/reports/pnl', useDates: true },
    ],
  },
  {
    title: 'Client Revenue Summary',
    description: 'Per-client revenue breakdown sorted by total, with invoice counts.',
    formats: [
      { label: 'Download PDF', format: 'pdf', route: '/api/reports/client-revenue', useDates: true },
      { label: 'Download CSV', format: 'csv', route: '/api/reports/client-revenue?format=csv', useDates: true },
    ],
  },
  {
    title: 'Expense Export',
    description: 'All expenses with date, category, description, amount, and client.',
    formats: [
      { label: 'Download CSV', format: 'csv', route: '/api/reports/expenses', useDates: true },
    ],
  },
  {
    title: 'Invoice Export',
    description: 'All invoices with status, amounts, dates, and recurring flag.',
    formats: [
      { label: 'Download CSV', format: 'csv', route: '/api/reports/invoices', useDates: true },
    ],
  },
  {
    title: 'Pipeline Report',
    description: 'Lead counts by stage, conversion rate, top deals, follow-up needs.',
    formats: [
      { label: 'Download PDF', format: 'pdf', route: '/api/reports/pipeline', useDates: false },
    ],
  },
  {
    title: 'Client Health Report',
    description: 'Health scores for all active clients grouped by status.',
    formats: [
      { label: 'Download PDF', format: 'pdf', route: '/api/reports/client-health', useDates: false },
    ],
  },
  {
    title: 'Ops Uptime Report',
    description: '30-day uptime, response times, and incidents per endpoint.',
    formats: [
      { label: 'Download PDF', format: 'pdf', route: '/api/reports/uptime', useDates: false },
    ],
  },
];

export default function ReportsPage() {
  const [start, setStart] = useState(yearStart);
  const [end, setEnd] = useState(today);

  function buildHref(route: string, useDates: boolean): string {
    if (!useDates) return route;
    const separator = route.includes('?') ? '&' : '?';
    return `${route}${separator}start=${start}&end=${end}`;
  }

  return (
    <div className="p-4 sm:p-6">
      <h2 className="text-2xl font-bold mb-4">Reports</h2>

      <div className="mb-6">
        <p className="text-xs text-gray-500 uppercase mb-2">Date Range (for financial reports)</p>
        <ReportDatePicker onChange={(s, e) => { setStart(s); setEnd(e); }} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((report) => (
          <div key={report.title} className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
            <h3 className="text-sm font-semibold text-white mb-1">{report.title}</h3>
            <p className="text-xs text-gray-400 mb-3">{report.description}</p>
            <div className="flex gap-2">
              {report.formats.map((f) => (
                <ExportButton
                  key={f.label}
                  href={buildHref(f.route, f.useDates)}
                  label={f.label}
                  format={f.format}
                  small
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add Reports to sidebar navigation**

Modify `src/components/sidebar.tsx` — add a new item to the `navItems` array at line 12 (after Ops):

```typescript
const navItems = [
  { href: '/', label: 'Dashboard', icon: '▣' },
  { href: '/clients', label: 'Clients', icon: '◉' },
  { href: '/pipeline', label: 'Pipeline', icon: '◈' },
  { href: '/finances', label: 'Finances', icon: '◇' },
  { href: '/ops', label: 'Ops', icon: '◆' },
  { href: '/reports', label: 'Reports', icon: '◫' },
];
```

- [ ] **Step 3: Add Reports to mobile navigation**

Modify `src/components/mobile-nav.tsx` — add a new item to the `navItems` array at line 11 (after Ops):

```typescript
const navItems = [
  { href: '/', label: 'Home', icon: '▣' },
  { href: '/clients', label: 'Clients', icon: '◉' },
  { href: '/pipeline', label: 'Pipeline', icon: '◈' },
  { href: '/finances', label: 'Finances', icon: '◇' },
  { href: '/ops', label: 'Ops', icon: '◆' },
  { href: '/reports', label: 'Reports', icon: '◫' },
];
```

- [ ] **Step 4: Verify the build compiles**

Run: `cd /Users/philipsmith/commandpost && npx next build`
Expected: Build succeeds with no errors

- [ ] **Step 5: Commit**

```bash
cd /Users/philipsmith/commandpost
git add src/app/\(dashboard\)/reports/page.tsx src/components/sidebar.tsx src/components/mobile-nav.tsx
git commit -m "feat: add Reports hub page with all 7 report types and nav items

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 9: Contextual Export Buttons on Existing Pages

**Files:**
- Modify: `src/app/(dashboard)/finances/page.tsx`
- Modify: `src/app/(dashboard)/pipeline/page.tsx`
- Modify: `src/app/(dashboard)/clients/page.tsx`
- Modify: `src/app/(dashboard)/ops/page.tsx`

- [ ] **Step 1: Add export buttons to Finances page**

Modify `src/app/(dashboard)/finances/page.tsx`:

Add import at the top (after existing imports):
```typescript
import { ExportButton } from '@/components/export-button';
```

In the `InvoicesTab` function, add after the summary stats grid (after closing `</div>` of the grid at line ~71), before the `{invoices.length === 0` conditional:
```tsx
      <div className="flex gap-2 mb-4">
        <ExportButton href={`/api/reports/invoices?start=${new Date().getFullYear()}-01-01&end=${new Date().toISOString().split('T')[0]}`} label="Export CSV" format="csv" small />
      </div>
```

In the `ExpensesTab` function, add after the monthly total paragraph (after line ~126), before the `<ExpenseForm>`:
```tsx
      <div className="flex gap-2 mb-4">
        <ExportButton href={`/api/reports/expenses?start=${currentMonth}-01&end=${currentMonth}-31`} label="Export CSV" format="csv" small />
      </div>
```

In the `RevenueTab` function, add after the YTD stats grid (after line ~195), before the `<RevenueChart>`:
```tsx
      <div className="flex gap-2 mb-4">
        <ExportButton href={`/api/reports/pnl?start=${new Date().getFullYear()}-01-01&end=${new Date().toISOString().split('T')[0]}`} label="P&L PDF" format="pdf" small />
        <ExportButton href={`/api/reports/client-revenue?format=csv&start=${new Date().getFullYear()}-01-01&end=${new Date().toISOString().split('T')[0]}`} label="Client Revenue CSV" format="csv" small />
      </div>
```

- [ ] **Step 2: Add export button to Pipeline page**

Modify `src/app/(dashboard)/pipeline/page.tsx`:

Add import at the top (after existing imports):
```typescript
import { ExportButton } from '@/components/export-button';
```

In the header div (line ~25), add after the `<div>` containing the h2 and summary p, before the `<Link>` for "+ New Lead":
```tsx
        <div className="flex items-center gap-2">
          <ExportButton href="/api/reports/pipeline" label="Pipeline Report" format="pdf" small />
          <Link
            href="/pipeline/new"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + New Lead
          </Link>
        </div>
```

And remove the existing standalone `<Link>` for "+ New Lead" that's currently a direct child of the flex container.

- [ ] **Step 3: Add export buttons to Clients page**

Modify `src/app/(dashboard)/clients/page.tsx`:

Add import at the top (after existing imports):
```typescript
import { ExportButton } from '@/components/export-button';
```

In the header div (line ~40), replace the standalone `<Link>` for "+ New Client" with:
```tsx
        <div className="flex items-center gap-2">
          <ExportButton href="/api/reports/client-health" label="Health Report" format="pdf" small />
          <ExportButton href={`/api/reports/client-revenue?format=csv&start=${new Date().getFullYear()}-01-01&end=${new Date().toISOString().split('T')[0]}`} label="Revenue CSV" format="csv" small />
          <Link
            href="/clients/new"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            + New Client
          </Link>
        </div>
```

- [ ] **Step 4: Add export button to Ops page**

Modify `src/app/(dashboard)/ops/page.tsx`:

Add import at the top (after existing imports):
```typescript
import { ExportButton } from '@/components/export-button';
```

In the header div (line ~34), replace the standalone `<Link>` for "+ Add Endpoint" with:
```tsx
        <div className="flex items-center gap-2">
          <ExportButton href="/api/reports/uptime" label="Uptime Report" format="pdf" small />
          <Link href="/ops/new" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
            + Add Endpoint
          </Link>
        </div>
```

- [ ] **Step 5: Verify build and run all tests**

Run: `cd /Users/philipsmith/commandpost && npx vitest run && npx next build`
Expected: All tests pass, build succeeds

- [ ] **Step 6: Commit**

```bash
cd /Users/philipsmith/commandpost
git add src/app/\(dashboard\)/finances/page.tsx src/app/\(dashboard\)/pipeline/page.tsx src/app/\(dashboard\)/clients/page.tsx src/app/\(dashboard\)/ops/page.tsx
git commit -m "feat: add contextual export buttons to finances, pipeline, clients, and ops pages

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 10: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `cd /Users/philipsmith/commandpost && npx vitest run`
Expected: All tests pass (existing + new report tests)

- [ ] **Step 2: Build the application**

Run: `cd /Users/philipsmith/commandpost && npx next build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Verify all report API routes respond**

Start the dev server and test each route:
```bash
cd /Users/philipsmith/commandpost && npx next dev -p 3004 &
sleep 5
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3004/api/reports/expenses?start=2026-01-01&end=2026-12-31"
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3004/api/reports/invoices?start=2026-01-01&end=2026-12-31"
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3004/api/reports/pnl?start=2026-01-01&end=2026-12-31"
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3004/api/reports/client-revenue?start=2026-01-01&end=2026-12-31"
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3004/api/reports/pipeline"
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3004/api/reports/client-health"
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3004/api/reports/uptime"
```
Expected: All return `200`

- [ ] **Step 4: Commit final state**

If any fixes were needed, commit them:
```bash
cd /Users/philipsmith/commandpost
git add -A
git commit -m "feat: Phase 10 complete — Reporting & Export with 7 report types

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```
