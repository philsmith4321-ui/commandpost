import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getInvoiceSummary, getMrr } from '@/lib/queries/invoice-queries';
import { getDashboardSummary } from '@/lib/queries/dashboard-queries';

export async function GET() {
  const db = getDb();
  const summary = getDashboardSummary(db);
  const invoiceSummary = getInvoiceSummary(db);
  const mrr = getMrr(db);

  return NextResponse.json({
    active_clients: summary.activeClients,
    monthly_revenue: summary.monthlyRevenue,
    mrr,
    outstanding_invoices: invoiceSummary.totalOutstanding,
    overdue_amount: invoiceSummary.totalOverdue,
    overdue_count: invoiceSummary.overdueCount,
    paid_this_month: invoiceSummary.paidThisMonth,
    pipeline_leads: summary.pipelineLeads,
    pipeline_value: summary.pipelineValue,
    uninvoiced_time: summary.uninvoicedTime,
    generated_at: new Date().toISOString(),
  });
}
