import type Database from 'better-sqlite3';

export interface SearchResult {
  type: 'client' | 'project' | 'lead' | 'invoice' | 'proposal' | 'activity';
  id: number;
  title: string;
  subtitle: string | null;
  link: string;
}

interface ClientSearchRow {
  id: number;
  name: string;
  contact_person: string | null;
  email: string | null;
}

interface ProjectSearchRow {
  id: number;
  name: string;
  client_name: string;
  client_id: number;
}

interface LeadSearchRow {
  id: number;
  business_name: string;
  contact_person: string | null;
}

interface InvoiceSearchRow {
  id: number;
  invoice_number: string;
  client_name: string;
}

interface ProposalSearchRow {
  id: number;
  title: string;
  business_name: string | null;
}

interface ActivitySearchRow {
  id: number;
  content: string;
  client_name: string;
  client_id: number;
}

export function globalSearch(db: Database.Database, query: string): SearchResult[] {
  if (!query || query.trim().length < 2) return [];

  const term = `%${query.trim()}%`;
  const results: SearchResult[] = [];

  // Clients
  const clients = db.prepare(`
    SELECT id, name, contact_person, email FROM clients
    WHERE deleted_at IS NULL AND (name LIKE ? OR contact_person LIKE ? OR email LIKE ?)
    LIMIT 5
  `).all(term, term, term) as ClientSearchRow[];
  for (const c of clients) {
    results.push({ type: 'client', id: c.id, title: c.name, subtitle: c.contact_person || c.email, link: `/clients/${c.id}` });
  }

  // Projects
  const projects = db.prepare(`
    SELECT p.id, p.name, c.name as client_name, c.id as client_id FROM projects p
    JOIN clients c ON p.client_id = c.id
    WHERE c.deleted_at IS NULL AND p.name LIKE ?
    LIMIT 5
  `).all(term) as ProjectSearchRow[];
  for (const p of projects) {
    results.push({ type: 'project', id: p.id, title: p.name, subtitle: p.client_name, link: `/clients/${p.client_id}/projects/${p.id}` });
  }

  // Leads
  const leads = db.prepare(`
    SELECT id, business_name, contact_person FROM leads
    WHERE business_name LIKE ? OR contact_person LIKE ?
    LIMIT 5
  `).all(term, term) as LeadSearchRow[];
  for (const l of leads) {
    results.push({ type: 'lead', id: l.id, title: l.business_name, subtitle: l.contact_person, link: `/pipeline/${l.id}` });
  }

  // Invoices
  const invoices = db.prepare(`
    SELECT i.id, i.invoice_number, c.name as client_name FROM invoices i
    JOIN clients c ON i.client_id = c.id
    WHERE i.invoice_number LIKE ? OR c.name LIKE ?
    LIMIT 5
  `).all(term, term) as InvoiceSearchRow[];
  for (const inv of invoices) {
    results.push({ type: 'invoice', id: inv.id, title: `Invoice ${inv.invoice_number}`, subtitle: inv.client_name, link: `/finances/invoices/${inv.id}` });
  }

  // Proposals
  const proposals = db.prepare(`
    SELECT p.id, p.title, l.business_name FROM proposals p
    LEFT JOIN leads l ON p.lead_id = l.id
    WHERE p.title LIKE ? OR l.business_name LIKE ?
    LIMIT 5
  `).all(term, term) as ProposalSearchRow[];
  for (const p of proposals) {
    results.push({ type: 'proposal', id: p.id, title: p.title, subtitle: p.business_name, link: `/proposals/${p.id}` });
  }

  // Activity logs
  const activities = db.prepare(`
    SELECT a.id, a.content, c.name as client_name, c.id as client_id FROM activity_logs a
    JOIN clients c ON a.client_id = c.id
    WHERE c.deleted_at IS NULL AND a.content LIKE ?
    LIMIT 5
  `).all(term) as ActivitySearchRow[];
  for (const a of activities) {
    results.push({ type: 'activity', id: a.id, title: a.content.slice(0, 80), subtitle: a.client_name, link: `/clients/${a.client_id}` });
  }

  return results;
}
