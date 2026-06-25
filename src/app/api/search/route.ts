import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

interface SearchResult {
  type: string;
  id: number;
  title: string;
  subtitle: string | null;
  link: string;
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2) return NextResponse.json([]);

  const db = getDb();
  const like = `%${q}%`;
  const results: SearchResult[] = [];

  // Clients
  const clients = db.prepare(
    "SELECT id, name, contact_person, email FROM clients WHERE name LIKE ? OR contact_person LIKE ? OR email LIKE ? LIMIT 5"
  ).all(like, like, like) as { id: number; name: string; contact_person: string | null; email: string | null }[];
  for (const c of clients) {
    results.push({ type: 'Client', id: c.id, title: c.name, subtitle: c.contact_person || c.email, link: `/clients/${c.id}` });
  }

  // Projects
  const projects = db.prepare(
    "SELECT p.id, p.name, p.status, c.name as client_name FROM projects p LEFT JOIN clients c ON p.client_id = c.id WHERE p.name LIKE ? LIMIT 5"
  ).all(like) as { id: number; name: string; status: string; client_name: string | null }[];
  for (const p of projects) {
    results.push({ type: 'Project', id: p.id, title: p.name, subtitle: p.client_name, link: `/clients/${p.id}` });
  }

  // Leads
  const leads = db.prepare(
    "SELECT id, business_name, contact_person, email FROM leads WHERE business_name LIKE ? OR contact_person LIKE ? OR email LIKE ? LIMIT 5"
  ).all(like, like, like) as { id: number; business_name: string; contact_person: string | null; email: string | null }[];
  for (const l of leads) {
    results.push({ type: 'Lead', id: l.id, title: l.business_name, subtitle: l.contact_person, link: `/pipeline/${l.id}` });
  }

  // Invoices
  const invoices = db.prepare(
    "SELECT i.id, i.invoice_number, i.total_amount, c.name as client_name FROM invoices i LEFT JOIN clients c ON i.client_id = c.id WHERE i.invoice_number LIKE ? OR c.name LIKE ? LIMIT 5"
  ).all(like, like) as { id: number; invoice_number: string; total_amount: number; client_name: string | null }[];
  for (const i of invoices) {
    results.push({ type: 'Invoice', id: i.id, title: i.invoice_number, subtitle: `$${i.total_amount} — ${i.client_name || ''}`, link: `/finances/invoices/${i.id}` });
  }

  // Proposals
  const proposals = db.prepare(
    "SELECT p.id, p.title, l.business_name as lead_name, c.name as client_name FROM proposals p LEFT JOIN leads l ON p.lead_id = l.id LEFT JOIN clients c ON p.client_id = c.id WHERE p.title LIKE ? LIMIT 5"
  ).all(like) as { id: number; title: string; lead_name: string | null; client_name: string | null }[];
  for (const p of proposals) {
    results.push({ type: 'Proposal', id: p.id, title: p.title, subtitle: p.client_name || p.lead_name, link: `/proposals/${p.id}` });
  }

  // Contracts
  const contracts = db.prepare(
    "SELECT ct.id, ct.title, c.name as client_name FROM contracts ct LEFT JOIN clients c ON ct.client_id = c.id WHERE ct.title LIKE ? LIMIT 5"
  ).all(like) as { id: number; title: string; client_name: string | null }[];
  for (const ct of contracts) {
    results.push({ type: 'Contract', id: ct.id, title: ct.title, subtitle: ct.client_name, link: `/contracts` });
  }

  return NextResponse.json(results);
}
