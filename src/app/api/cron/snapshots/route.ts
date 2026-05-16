import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { saveSnapshot } from '@/lib/queries/snapshot-queries';
import { getInvoiceSummary, getMrr } from '@/lib/queries/invoice-queries';
import { getDashboardSummary } from '@/lib/queries/dashboard-queries';

export async function GET() {
  const db = getDb();
  const summary = getDashboardSummary(db);
  const invoiceSummary = getInvoiceSummary(db);
  const mrr = getMrr(db);

  saveSnapshot(db, 'active_clients', summary.activeClients);
  saveSnapshot(db, 'mrr', mrr);
  saveSnapshot(db, 'outstanding', invoiceSummary.totalOutstanding);
  saveSnapshot(db, 'overdue', invoiceSummary.totalOverdue);
  saveSnapshot(db, 'pipeline_value', summary.pipelineValue);
  saveSnapshot(db, 'pipeline_leads', summary.pipelineLeads);
  saveSnapshot(db, 'monthly_revenue', summary.monthlyRevenue);

  return NextResponse.json({ saved: true, date: new Date().toISOString().split('T')[0] });
}
