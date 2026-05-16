import type Database from 'better-sqlite3';
import crypto from 'crypto';

interface PortalClient {
  id: number;
  name: string;
  contact_person: string | null;
  email: string | null;
}

interface PortalDeliverable {
  id: number;
  title: string;
  status: string;
  due_date: string | null;
}

interface PortalProject {
  id: number;
  name: string;
  status: string;
  deliverables: PortalDeliverable[];
}

interface PortalInvoice {
  id: number;
  invoice_number: string;
  status: string;
  due_date: string;
  total_amount: number;
  stripe_payment_link: string | null;
}

interface PortalActivityItem {
  id: number;
  type: string;
  title: string;
  message: string | null;
  created_at: string;
}

export function generatePortalToken(db: Database.Database, clientId: number): string {
  const existing = db.prepare('SELECT portal_token FROM clients WHERE id = ?').get(clientId) as { portal_token: string | null } | undefined;
  if (existing?.portal_token) return existing.portal_token;

  const token = crypto.randomUUID();
  db.prepare('UPDATE clients SET portal_token = ? WHERE id = ?').run(token, clientId);
  return token;
}

export function resetPortalToken(db: Database.Database, clientId: number): string {
  const token = crypto.randomUUID();
  db.prepare('UPDATE clients SET portal_token = ? WHERE id = ?').run(token, clientId);
  return token;
}

export function getClientByPortalToken(db: Database.Database, token: string): PortalClient | undefined {
  return db.prepare(
    'SELECT id, name, contact_person, email FROM clients WHERE portal_token = ? AND deleted_at IS NULL'
  ).get(token) as PortalClient | undefined;
}

export function getPortalProjects(db: Database.Database, clientId: number): PortalProject[] {
  const projects = db.prepare(
    "SELECT id, name, status FROM projects WHERE client_id = ? AND status IN ('active', 'on-hold') ORDER BY created_at DESC"
  ).all(clientId) as { id: number; name: string; status: string }[];

  return projects.map(p => {
    const deliverables = db.prepare(
      'SELECT id, title, status, due_date FROM deliverables WHERE project_id = ? ORDER BY created_at ASC'
    ).all(p.id) as PortalDeliverable[];
    return { ...p, deliverables };
  });
}

export function getPortalInvoices(db: Database.Database, clientId: number): PortalInvoice[] {
  return db.prepare(`
    SELECT id, invoice_number, status, due_date, total_amount, stripe_payment_link
    FROM invoices
    WHERE client_id = ? AND (
      status = 'sent'
      OR (status = 'paid' AND paid_at >= date('now', '-90 days'))
    )
    ORDER BY
      CASE WHEN status = 'sent' THEN 0 ELSE 1 END,
      due_date DESC
  `).all(clientId) as PortalInvoice[];
}

export function getPortalActivity(db: Database.Database, clientId: number): PortalActivityItem[] {
  const invoiceIds = db.prepare(
    'SELECT id FROM invoices WHERE client_id = ?'
  ).all(clientId) as { id: number }[];

  if (invoiceIds.length === 0) {
    return db.prepare(`
      SELECT id, type, title, message, created_at FROM notifications
      WHERE link LIKE '/clients/' || ? || '%'
      ORDER BY created_at DESC LIMIT 10
    `).all(clientId) as PortalActivityItem[];
  }

  const placeholders = invoiceIds.map(() => '?').join(',');
  const invoicePaths = invoiceIds.map(i => `/finances/invoices/${i.id}`);

  return db.prepare(`
    SELECT id, type, title, message, created_at FROM notifications
    WHERE link LIKE '/clients/' || ? || '%'
       OR link IN (${placeholders})
    ORDER BY created_at DESC LIMIT 10
  `).all(clientId, ...invoicePaths) as PortalActivityItem[];
}
