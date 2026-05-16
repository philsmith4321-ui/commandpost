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
