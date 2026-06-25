import type Database from 'better-sqlite3';
import type { Client, ClientStatus, ClientHealth, ClientHealthStatus } from '@/lib/types';

interface CreateClientInput {
  name: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  source?: string | null;
  status: ClientStatus;
  monthly_value?: number | null;
}

interface UpdateClientInput {
  name?: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  source?: string | null;
  status?: ClientStatus;
  monthly_value?: number | null;
}

interface ListClientsFilter {
  status?: ClientStatus;
  search?: string;
}

export function createClient(db: Database.Database, input: CreateClientInput): number {
  const stmt = db.prepare(`
    INSERT INTO clients (name, contact_person, email, phone, notes, source, status, monthly_value)
    VALUES (@name, @contact_person, @email, @phone, @notes, @source, @status, @monthly_value)
  `);

  const result = stmt.run({
    name: input.name,
    contact_person: input.contact_person ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    notes: input.notes ?? null,
    source: input.source ?? null,
    status: input.status,
    monthly_value: input.monthly_value ?? null,
  });

  return Number(result.lastInsertRowid);
}

export function getClientById(db: Database.Database, id: number): Client | undefined {
  return db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as Client | undefined;
}

export function listClients(db: Database.Database, filter?: ListClientsFilter): Client[] {
  let sql = 'SELECT * FROM clients WHERE deleted_at IS NULL';
  const params: string[] = [];

  if (filter?.status) {
    sql += ' AND status = ?';
    params.push(filter.status);
  }

  if (filter?.search) {
    sql += ' AND (name LIKE ? OR contact_person LIKE ?)';
    params.push(`%${filter.search}%`, `%${filter.search}%`);
  }

  sql += ' ORDER BY updated_at DESC';

  return db.prepare(sql).all(...params) as Client[];
}

export function updateClient(db: Database.Database, id: number, input: UpdateClientInput): void {
  const fields: string[] = [];
  const params: Record<string, unknown> = { id };

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      fields.push(`${key} = @${key}`);
      params[key] = value;
    }
  }

  if (fields.length === 0) return;

  fields.push("updated_at = datetime('now')");

  db.prepare(`UPDATE clients SET ${fields.join(', ')} WHERE id = @id`).run(params);

  // Cascade: if status changed to completed, complete all active projects
  if (input.status === 'completed') {
    db.prepare(
      "UPDATE projects SET status = 'completed', updated_at = datetime('now') WHERE client_id = ? AND status = 'active'"
    ).run(id);
  }
}

export function softDeleteClient(db: Database.Database, id: number): void {
  db.prepare("UPDATE clients SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(id);
}

export function getClientHealth(db: Database.Database, clientId: number): ClientHealth {
  const client = db.prepare("SELECT id, name FROM clients WHERE id = ?").get(clientId) as { id: number; name: string };

  // Payment speed (40 points) — avg days to pay in last 6 months
  const paymentRow = db.prepare(`
    SELECT AVG(julianday(paid_at) - julianday(sent_at)) as avg_days
    FROM invoices
    WHERE client_id = ? AND status = 'paid' AND sent_at IS NOT NULL
      AND paid_at >= date('now', '-6 months')
  `).get(clientId) as { avg_days: number | null };

  let payment: number;
  if (paymentRow.avg_days === null) {
    payment = 20;
  } else if (paymentRow.avg_days <= 7) {
    payment = 40;
  } else if (paymentRow.avg_days <= 14) {
    payment = 30;
  } else if (paymentRow.avg_days <= 30) {
    payment = 20;
  } else {
    payment = 10;
  }

  // Outstanding balance (30 points)
  const outstanding = (db.prepare(
    "SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE client_id = ? AND status = 'sent'"
  ).get(clientId) as { total: number }).total;
  const overdue = (db.prepare(
    "SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE client_id = ? AND status = 'sent' AND due_date < date('now')"
  ).get(clientId) as { total: number }).total;

  let balance: number;
  if (outstanding === 0) {
    balance = 30;
  } else if (overdue > 0) {
    balance = 0;
  } else {
    balance = 15;
  }

  // Engagement (30 points) — days since last activity
  const lastActivity = db.prepare(
    "SELECT created_at FROM activity_logs WHERE client_id = ? ORDER BY created_at DESC LIMIT 1"
  ).get(clientId) as { created_at: string } | undefined;

  let engagement: number;
  if (!lastActivity) {
    engagement = 0;
  } else {
    const daysSince = (db.prepare(
      "SELECT julianday('now') - julianday(?) as days"
    ).get(lastActivity.created_at) as { days: number }).days;
    if (daysSince <= 7) {
      engagement = 30;
    } else if (daysSince <= 14) {
      engagement = 25;
    } else if (daysSince <= 30) {
      engagement = 15;
    } else if (daysSince <= 60) {
      engagement = 5;
    } else {
      engagement = 0;
    }
  }

  const score = payment + balance + engagement;
  let status: ClientHealthStatus;
  if (score >= 70) {
    status = 'healthy';
  } else if (score >= 40) {
    status = 'at_risk';
  } else {
    status = 'needs_attention';
  }

  return { clientId: client.id, clientName: client.name, score, status, payment, balance, engagement };
}

export function getClientHealthSummary(db: Database.Database): ClientHealth[] {
  const clients = db.prepare(
    "SELECT id FROM clients WHERE status = 'active' AND deleted_at IS NULL"
  ).all() as { id: number }[];

  return clients.map(c => getClientHealth(db, c.id));
}
