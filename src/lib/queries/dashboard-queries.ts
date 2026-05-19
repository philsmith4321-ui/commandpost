import type Database from 'better-sqlite3';
import { getMrr } from '@/lib/queries/invoice-queries';
import { getClientHealthSummary } from '@/lib/queries/client-queries';

export interface DashboardSummary {
  activeClients: number;
  overdueDeliverables: number;
  monthlyRevenue: number;
  pipelineLeads: number;
  pipelineValue: number;
  needsFollowUp: number;
  outstandingInvoices: number;
  overdueInvoiceAmount: number;
  mrr: number;
  uninvoicedTime: number;
}

export interface ActionItem {
  type: 'overdue_deliverable' | 'due_soon_deliverable' | 'missed_follow_up' | 'overdue_invoice' | 'client_needs_attention' | 'client_at_risk';
  title: string;
  link: string;
  urgency: 'red' | 'yellow';
}

export interface RecentActivity {
  content: string;
  created_at: string;
  client_name: string;
}

export function getDashboardSummary(db: Database.Database): DashboardSummary {
  const activeClients = (db.prepare("SELECT COUNT(*) as count FROM clients WHERE status = 'active' AND deleted_at IS NULL").get() as any).count;
  const overdueDeliverables = (db.prepare(`
    SELECT COUNT(*) as count FROM deliverables d
    JOIN projects p ON d.project_id = p.id
    JOIN clients c ON p.client_id = c.id
    WHERE d.status != 'delivered' AND d.due_date < date('now') AND c.deleted_at IS NULL
  `).get() as any).count;
  const monthlyRevenue = (db.prepare("SELECT COALESCE(SUM(monthly_value), 0) as total FROM clients WHERE status = 'active' AND deleted_at IS NULL").get() as any).total;

  const pipelineLeads = (db.prepare("SELECT COUNT(*) as count FROM leads WHERE stage NOT IN ('won','lost')").get() as any).count;
  const pipelineValue = (db.prepare("SELECT COALESCE(SUM(estimated_value), 0) as total FROM leads WHERE stage NOT IN ('won','lost')").get() as any).total;
  const needsFollowUp = (db.prepare("SELECT COUNT(*) as count FROM leads WHERE stage NOT IN ('won','lost') AND follow_up_date < date('now')").get() as any).count;

  const outstandingInvoices = (db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'sent'").get() as any).total;
  const overdueInvoiceAmount = (db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'sent' AND due_date < date('now')").get() as any).total;

  const mrr = getMrr(db);

  const uninvoicedTime = (db.prepare("SELECT COALESCE(SUM(duration_minutes * hourly_rate / 60.0), 0) as total FROM time_entries WHERE is_invoiced = 0").get() as any).total;

  return { activeClients, overdueDeliverables, monthlyRevenue, pipelineLeads, pipelineValue, needsFollowUp, outstandingInvoices, overdueInvoiceAmount, mrr, uninvoicedTime };
}

export function getActionItems(db: Database.Database): ActionItem[] {
  const items: ActionItem[] = [];

  const overdue = db.prepare(`
    SELECT d.title, d.due_date, p.id as project_id, p.name as project_name, c.id as client_id, c.name as client_name
    FROM deliverables d JOIN projects p ON d.project_id = p.id JOIN clients c ON p.client_id = c.id
    WHERE d.status != 'delivered' AND d.due_date < date('now') AND c.deleted_at IS NULL
    ORDER BY d.due_date ASC
  `).all() as any[];

  for (const d of overdue) {
    items.push({
      type: 'overdue_deliverable',
      title: `Overdue: ${d.title} (${d.client_name} / ${d.project_name})`,
      link: `/clients/${d.client_id}/projects/${d.project_id}`,
      urgency: 'red',
    });
  }

  const dueSoon = db.prepare(`
    SELECT d.title, d.due_date, p.id as project_id, p.name as project_name, c.id as client_id, c.name as client_name
    FROM deliverables d JOIN projects p ON d.project_id = p.id JOIN clients c ON p.client_id = c.id
    WHERE d.status != 'delivered' AND d.due_date >= date('now') AND d.due_date <= date('now', '+3 days') AND c.deleted_at IS NULL
    ORDER BY d.due_date ASC
  `).all() as any[];

  for (const d of dueSoon) {
    items.push({
      type: 'due_soon_deliverable',
      title: `Due soon: ${d.title} (${d.client_name} / ${d.project_name}) — ${d.due_date}`,
      link: `/clients/${d.client_id}/projects/${d.project_id}`,
      urgency: 'yellow',
    });
  }

  // Missed lead follow-ups
  const missedFollowUps = db.prepare(`
    SELECT id, business_name, contact_person, follow_up_date
    FROM leads
    WHERE stage NOT IN ('won','lost') AND follow_up_date < date('now')
    ORDER BY follow_up_date ASC
  `).all() as any[];

  for (const lead of missedFollowUps) {
    items.push({
      type: 'missed_follow_up',
      title: `Follow up: ${lead.business_name}${lead.contact_person ? ` (${lead.contact_person})` : ''} — was due ${lead.follow_up_date}`,
      link: `/pipeline/${lead.id}`,
      urgency: 'yellow',
    });
  }

  // Overdue invoices
  const overdueInvoices = db.prepare(`
    SELECT i.id, i.invoice_number, i.total_amount, i.due_date, c.name as client_name
    FROM invoices i JOIN clients c ON i.client_id = c.id
    WHERE i.status = 'sent' AND i.due_date < date('now')
    ORDER BY i.due_date ASC
  `).all() as any[];

  for (const inv of overdueInvoices) {
    items.push({
      type: 'overdue_invoice',
      title: `Overdue invoice: ${inv.invoice_number} for ${inv.client_name} — $${inv.total_amount.toLocaleString()} due ${inv.due_date}`,
      link: `/finances/invoices/${inv.id}`,
      urgency: 'red',
    });
  }

  // Client health
  const clientHealth = getClientHealthSummary(db);
  for (const h of clientHealth) {
    if (h.status === 'needs_attention') {
      items.push({
        type: 'client_needs_attention',
        title: `${h.clientName} — health ${h.score}/100`,
        link: `/clients/${h.clientId}`,
        urgency: 'red',
      });
    } else if (h.status === 'at_risk') {
      items.push({
        type: 'client_at_risk',
        title: `${h.clientName} — health ${h.score}/100`,
        link: `/clients/${h.clientId}`,
        urgency: 'yellow',
      });
    }
  }

  return items;
}

export interface PinnedClient {
  id: number;
  name: string;
  status: string;
  monthly_value: number | null;
}

export function getPinnedClients(db: Database.Database): PinnedClient[] {
  return db.prepare("SELECT id, name, status, monthly_value FROM clients WHERE is_pinned = 1 AND deleted_at IS NULL ORDER BY name").all() as PinnedClient[];
}

export function getRecentActivity(db: Database.Database, limit: number = 20): RecentActivity[] {
  return db.prepare(`
    SELECT a.content, a.created_at, c.name as client_name
    FROM activity_logs a JOIN clients c ON a.client_id = c.id
    WHERE c.deleted_at IS NULL ORDER BY a.created_at DESC LIMIT ?
  `).all(limit) as RecentActivity[];
}

export interface RevenueTrendPoint {
  month: string;
  label: string;
  amount: number;
}

export function getRevenueTrend(db: Database.Database): RevenueTrendPoint[] {
  const rows = db.prepare(`
    SELECT strftime('%Y-%m', paid_at) as month, SUM(total_amount) as amount
    FROM invoices
    WHERE status = 'paid' AND paid_at >= date('now', '-6 months')
    GROUP BY strftime('%Y-%m', paid_at)
    ORDER BY month ASC
  `).all() as { month: string; amount: number }[];

  // Fill in missing months
  const result: RevenueTrendPoint[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString('en-US', { month: 'short' });
    const found = rows.find(r => r.month === month);
    result.push({ month, label, amount: found ? found.amount : 0 });
  }
  return result;
}

export interface UpcomingDeadline {
  type: 'deliverable' | 'follow_up' | 'contract';
  title: string;
  date: string;
  link: string;
}

export function getUpcomingDeadlines(db: Database.Database): UpcomingDeadline[] {
  const deadlines: UpcomingDeadline[] = [];

  // Deliverables due in next 7 days
  const deliverables = db.prepare(`
    SELECT d.title, d.due_date, p.id as project_id, c.id as client_id
    FROM deliverables d JOIN projects p ON d.project_id = p.id JOIN clients c ON p.client_id = c.id
    WHERE d.status != 'delivered' AND d.due_date >= date('now') AND d.due_date <= date('now', '+7 days') AND c.deleted_at IS NULL
    ORDER BY d.due_date ASC
  `).all() as any[];

  for (const d of deliverables) {
    deadlines.push({ type: 'deliverable', title: d.title, date: d.due_date, link: `/clients/${d.client_id}/projects/${d.project_id}` });
  }

  // Follow-ups in next 7 days
  const followUps = db.prepare(`
    SELECT id, business_name, follow_up_date
    FROM leads WHERE stage NOT IN ('won','lost') AND follow_up_date >= date('now') AND follow_up_date <= date('now', '+7 days')
    ORDER BY follow_up_date ASC
  `).all() as any[];

  for (const f of followUps) {
    deadlines.push({ type: 'follow_up', title: f.business_name, date: f.follow_up_date, link: `/pipeline/${f.id}` });
  }

  // Contracts expiring in next 30 days
  const contracts = db.prepare(`
    SELECT id, title, expires_at
    FROM contracts WHERE expires_at >= date('now') AND expires_at <= date('now', '+30 days')
    ORDER BY expires_at ASC
  `).all() as any[];

  for (const c of contracts) {
    deadlines.push({ type: 'contract', title: c.title, date: c.expires_at, link: `/contracts` });
  }

  deadlines.sort((a, b) => a.date.localeCompare(b.date));
  return deadlines;
}
