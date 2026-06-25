import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { createNotification } from '@/lib/notifications';
import { hasAlertBeenSentToday, hasAlertBeenSentInLastDays } from '@/lib/queries/alert-queries';
import { getClientHealthSummary } from '@/lib/queries/client-queries';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  let created = 0;

  // Overdue invoices
  const overdueInvoices = db.prepare(`
    SELECT i.id, i.invoice_number, i.total_amount, c.name as client_name
    FROM invoices i JOIN clients c ON i.client_id = c.id
    WHERE i.status = 'sent' AND i.due_date < date('now')
  `).all() as { id: number; invoice_number: string; total_amount: number; client_name: string }[];

  for (const inv of overdueInvoices) {
    if (!hasAlertBeenSentToday(db, 'invoice_overdue', inv.id)) {
      await createNotification(db, {
        type: 'invoice_overdue',
        title: `Invoice ${inv.invoice_number} overdue`,
        message: `${inv.client_name} — $${inv.total_amount}`,
        link: `/finances/invoices/${inv.id}`,
      });
      created++;
    }
  }

  // Overdue deliverables
  const overdueDeliverables = db.prepare(`
    SELECT d.id, d.title, p.id as project_id, c.id as client_id, c.name as client_name, p.name as project_name
    FROM deliverables d JOIN projects p ON d.project_id = p.id JOIN clients c ON p.client_id = c.id
    WHERE d.status != 'delivered' AND d.due_date < date('now') AND c.deleted_at IS NULL
  `).all() as { id: number; title: string; project_id: number; client_id: number; client_name: string; project_name: string }[];

  for (const d of overdueDeliverables) {
    if (!hasAlertBeenSentToday(db, 'deliverable_overdue', d.id)) {
      await createNotification(db, {
        type: 'deliverable_overdue',
        title: `Deliverable overdue: ${d.title}`,
        message: `${d.client_name} / ${d.project_name}`,
        link: `/clients/${d.client_id}/projects/${d.project_id}`,
      });
      created++;
    }
  }

  // Follow-ups due
  const followUps = db.prepare(`
    SELECT id, business_name, contact_person
    FROM leads WHERE stage NOT IN ('won','lost') AND follow_up_date <= date('now')
  `).all() as { id: number; business_name: string; contact_person: string | null }[];

  for (const lead of followUps) {
    if (!hasAlertBeenSentToday(db, 'follow_up_due', lead.id)) {
      await createNotification(db, {
        type: 'follow_up_due',
        title: `Follow up: ${lead.business_name}`,
        message: lead.contact_person ? `Contact: ${lead.contact_person}` : null,
        link: `/pipeline/${lead.id}`,
      });
      created++;
    }
  }

  // Client health critical
  const healthData = getClientHealthSummary(db);
  for (const h of healthData) {
    if (h.status === 'needs_attention') {
      if (!hasAlertBeenSentInLastDays(db, 'client_health_warning', h.clientId, 7)) {
        await createNotification(db, {
          type: 'client_health_critical',
          title: `${h.clientName} needs attention`,
          message: `Health score: ${h.score}/100`,
          link: `/clients/${h.clientId}`,
        });
        created++;
      }
    }
  }

  // Contracts expiring soon
  const { getExpiringContracts } = await import('@/lib/queries/contract-queries');
  const expiringContracts = getExpiringContracts(db, 30);
  for (const contract of expiringContracts) {
    if (!hasAlertBeenSentInLastDays(db, 'contract_expiring', contract.id, 7)) {
      await createNotification(db, {
        type: 'contract_expiring',
        title: `Contract expiring: ${contract.title}`,
        message: `${contract.client_name} — expires ${contract.expires_at}`,
        link: `/contracts`,
      });
      created++;
    }
  }

  return NextResponse.json({ ok: true, created });
}
