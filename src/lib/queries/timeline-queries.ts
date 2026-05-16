import type Database from 'better-sqlite3';

export interface TimelineEvent {
  id: string;
  type: 'invoice_paid' | 'invoice_sent' | 'lead_stage' | 'deliverable_completed' | 'client_added' | 'meeting' | 'activity';
  title: string;
  description: string | null;
  link: string | null;
  timestamp: string;
}

export function getTimeline(db: Database.Database, limit = 50): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Paid invoices
  const paidInvoices = db.prepare(`
    SELECT i.id, i.invoice_number, i.total_amount, i.paid_at as timestamp, c.name as client_name, i.client_id
    FROM invoices i JOIN clients c ON i.client_id = c.id
    WHERE i.status = 'paid' AND i.paid_at IS NOT NULL
    ORDER BY i.paid_at DESC LIMIT ?
  `).all(limit) as any[];
  for (const inv of paidInvoices) {
    events.push({
      id: `inv-paid-${inv.id}`,
      type: 'invoice_paid',
      title: `${inv.invoice_number} paid`,
      description: `$${inv.total_amount.toLocaleString()} from ${inv.client_name}`,
      link: `/finances/invoices/${inv.id}`,
      timestamp: inv.timestamp,
    });
  }

  // Sent invoices
  const sentInvoices = db.prepare(`
    SELECT i.id, i.invoice_number, i.total_amount, i.sent_at as timestamp, c.name as client_name
    FROM invoices i JOIN clients c ON i.client_id = c.id
    WHERE i.sent_at IS NOT NULL
    ORDER BY i.sent_at DESC LIMIT ?
  `).all(limit) as any[];
  for (const inv of sentInvoices) {
    events.push({
      id: `inv-sent-${inv.id}`,
      type: 'invoice_sent',
      title: `${inv.invoice_number} sent`,
      description: `$${inv.total_amount.toLocaleString()} to ${inv.client_name}`,
      link: `/finances/invoices/${inv.id}`,
      timestamp: inv.timestamp,
    });
  }

  // Lead stage changes
  const stageChanges = db.prepare(`
    SELECT h.id, h.stage, h.entered_at as timestamp, l.business_name, l.id as lead_id
    FROM lead_stage_history h JOIN leads l ON h.lead_id = l.id
    ORDER BY h.entered_at DESC LIMIT ?
  `).all(limit) as any[];
  for (const s of stageChanges) {
    events.push({
      id: `lead-stage-${s.id}`,
      type: 'lead_stage',
      title: `${s.business_name} → ${s.stage}`,
      description: null,
      link: `/pipeline/${s.lead_id}`,
      timestamp: s.timestamp,
    });
  }

  // Completed deliverables
  const deliverables = db.prepare(`
    SELECT d.id, d.title, d.completed_at as timestamp, p.name as project_name, p.client_id
    FROM deliverables d JOIN projects p ON d.project_id = p.id
    WHERE d.status = 'delivered' AND d.completed_at IS NOT NULL
    ORDER BY d.completed_at DESC LIMIT ?
  `).all(limit) as any[];
  for (const d of deliverables) {
    events.push({
      id: `deliv-${d.id}`,
      type: 'deliverable_completed',
      title: `Delivered: ${d.title}`,
      description: d.project_name,
      link: `/clients/${d.client_id}`,
      timestamp: d.timestamp,
    });
  }

  // New clients
  const clients = db.prepare(`
    SELECT id, name, created_at as timestamp FROM clients
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC LIMIT ?
  `).all(limit) as any[];
  for (const c of clients) {
    events.push({
      id: `client-${c.id}`,
      type: 'client_added',
      title: `New client: ${c.name}`,
      description: null,
      link: `/clients/${c.id}`,
      timestamp: c.timestamp,
    });
  }

  // Meetings
  const meetings = db.prepare(`
    SELECT m.id, m.title, m.meeting_date as timestamp, c.name as client_name, m.client_id
    FROM meetings m JOIN clients c ON m.client_id = c.id
    ORDER BY m.meeting_date DESC LIMIT ?
  `).all(limit) as any[];
  for (const m of meetings) {
    events.push({
      id: `meeting-${m.id}`,
      type: 'meeting',
      title: m.title,
      description: m.client_name,
      link: `/clients/${m.client_id}`,
      timestamp: m.timestamp,
    });
  }

  // Sort all by timestamp descending and take limit
  events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return events.slice(0, limit);
}
