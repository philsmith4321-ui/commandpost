import type Database from 'better-sqlite3';

export interface DashboardSummary {
  activeClients: number;
  overdueDeliverables: number;
  monthlyRevenue: number;
}

export interface ActionItem {
  type: 'overdue_deliverable' | 'due_soon_deliverable';
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
  return { activeClients, overdueDeliverables, monthlyRevenue };
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

  return items;
}

export function getRecentActivity(db: Database.Database, limit: number = 20): RecentActivity[] {
  return db.prepare(`
    SELECT a.content, a.created_at, c.name as client_name
    FROM activity_logs a JOIN clients c ON a.client_id = c.id
    WHERE c.deleted_at IS NULL ORDER BY a.created_at DESC LIMIT ?
  `).all(limit) as RecentActivity[];
}
