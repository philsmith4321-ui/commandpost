import type Database from 'better-sqlite3';

export interface ClientActivity {
  id: string;
  type: string;
  title: string;
  description: string | null;
  timestamp: string;
  link: string | null;
}

interface InvoiceActivityRow {
  id: number;
  invoice_number: string;
  status: string;
  total_amount: number;
  created_at: string;
  paid_at: string | null;
  sent_at: string | null;
}

interface ProposalActivityRow {
  id: number;
  title: string;
  status: string;
  created_at: string;
  accepted_at: string | null;
}

interface MeetingActivityRow {
  id: number;
  title: string;
  meeting_date: string;
}

interface LogActivityRow {
  id: number;
  content: string;
  created_at: string;
}

interface TimeActivityRow {
  id: number;
  description: string | null;
  duration_minutes: number;
  entry_date: string;
  project_name: string;
}

export function getClientActivity(db: Database.Database, clientId: number, limit = 50): ClientActivity[] {
  const events: ClientActivity[] = [];

  // Invoices
  const invoices = db.prepare(
    "SELECT id, invoice_number, status, total_amount, created_at, paid_at, sent_at FROM invoices WHERE client_id = ? ORDER BY created_at DESC LIMIT ?"
  ).all(clientId, limit) as InvoiceActivityRow[];
  for (const inv of invoices) {
    if (inv.paid_at) {
      events.push({ id: `inv-paid-${inv.id}`, type: 'invoice_paid', title: `Invoice ${inv.invoice_number} paid`, description: `$${inv.total_amount}`, timestamp: inv.paid_at, link: `/finances/invoices/${inv.id}` });
    }
    if (inv.sent_at) {
      events.push({ id: `inv-sent-${inv.id}`, type: 'invoice_sent', title: `Invoice ${inv.invoice_number} sent`, description: `$${inv.total_amount}`, timestamp: inv.sent_at, link: `/finances/invoices/${inv.id}` });
    }
    events.push({ id: `inv-created-${inv.id}`, type: 'invoice_created', title: `Invoice ${inv.invoice_number} created`, description: `$${inv.total_amount}`, timestamp: inv.created_at, link: `/finances/invoices/${inv.id}` });
  }

  // Proposals
  const proposals = db.prepare(
    "SELECT id, title, status, created_at, accepted_at FROM proposals WHERE client_id = ? ORDER BY created_at DESC LIMIT ?"
  ).all(clientId, limit) as ProposalActivityRow[];
  for (const p of proposals) {
    events.push({ id: `prop-${p.id}`, type: 'proposal', title: `Proposal: ${p.title}`, description: p.status, timestamp: p.created_at, link: `/proposals/${p.id}` });
  }

  // Meetings
  const meetings = db.prepare(
    "SELECT id, title, meeting_date FROM meetings WHERE client_id = ? ORDER BY meeting_date DESC LIMIT ?"
  ).all(clientId, limit) as MeetingActivityRow[];
  for (const m of meetings) {
    events.push({ id: `mtg-${m.id}`, type: 'meeting', title: `Meeting: ${m.title}`, description: null, timestamp: m.meeting_date, link: `/meetings` });
  }

  // Activity logs
  const logs = db.prepare(
    "SELECT id, content, created_at FROM activity_logs WHERE client_id = ? ORDER BY created_at DESC LIMIT ?"
  ).all(clientId, limit) as LogActivityRow[];
  for (const l of logs) {
    events.push({ id: `log-${l.id}`, type: 'activity', title: 'Activity logged', description: l.content, timestamp: l.created_at, link: null });
  }

  // Time entries via projects
  const time = db.prepare(
    "SELECT te.id, te.description, te.duration_minutes, te.entry_date, p.name as project_name FROM time_entries te JOIN projects p ON p.id = te.project_id WHERE p.client_id = ? ORDER BY te.entry_date DESC LIMIT ?"
  ).all(clientId, limit) as TimeActivityRow[];
  for (const t of time) {
    events.push({ id: `time-${t.id}`, type: 'time', title: `${(t.duration_minutes / 60).toFixed(1)}h on ${t.project_name}`, description: t.description, timestamp: t.entry_date, link: `/finances/time` });
  }

  events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return events.slice(0, limit);
}
