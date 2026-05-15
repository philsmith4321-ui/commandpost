import type Database from 'better-sqlite3';
import type { Client, ClientStatus } from '@/lib/types';

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
  const params: any[] = [];

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
  const params: any = { id };

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
