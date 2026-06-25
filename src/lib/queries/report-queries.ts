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

export function getPnlData(db: Database.Database, start: string, end: string): PnlData {
  const revenue = (db.prepare(
    "SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'paid' AND paid_at >= ? AND paid_at <= ?"
  ).get(start, end) as { total: number }).total;

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
  ).all() as { estimated_value: number | null }[];

  const totalActiveLeads = activeLeads.length;
  const totalActiveValue = activeLeads.reduce((sum: number, l) => sum + (l.estimated_value || 0), 0);

  const won = (db.prepare("SELECT COUNT(*) as count FROM leads WHERE stage = 'won'").get() as { count: number }).count;
  const lost = (db.prepare("SELECT COUNT(*) as count FROM leads WHERE stage = 'lost'").get() as { count: number }).count;
  const conversionRate = (won + lost) > 0 ? (won / (won + lost)) * 100 : 0;

  const averageDealValue = totalActiveLeads > 0 ? totalActiveValue / totalActiveLeads : 0;

  const needsFollowUp = (db.prepare(
    "SELECT COUNT(*) as count FROM leads WHERE stage NOT IN ('won','lost') AND follow_up_date < date('now')"
  ).get() as { count: number }).count;

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

