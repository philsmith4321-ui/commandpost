import { initDb } from '../src/lib/db';
import { isTwilioConfigured, sendSms } from '../src/lib/twilio';
import { recordAlert } from '../src/lib/queries/alert-queries';
import { getActionItems, getDashboardSummary } from '../src/lib/queries/dashboard-queries';
import { getCriticalDiskReports } from '../src/lib/queries/disk-report-queries';
import { isClaudeConfigured, askClaude } from '../src/lib/claude';
import { getRevenueByClient } from '../src/lib/queries/finance-queries';

function getLastMonthStats(db: ReturnType<typeof initDb>): { revenue: number; expenses: number; profit: number; outstanding: number } {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const ym = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;

  const revenue = (db.prepare(
    "SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'paid' AND strftime('%Y-%m', paid_at) = ?"
  ).get(ym) as any).total;

  const expenses = (db.prepare(
    "SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE strftime('%Y-%m', expense_date) = ?"
  ).get(ym) as any).total;

  const outstanding = (db.prepare(
    "SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'sent'"
  ).get() as any).total;

  return { revenue, expenses, profit: revenue - expenses, outstanding };
}

function getWeeklyInsightsData(db: ReturnType<typeof initDb>): string {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
  const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const twoMonthsAgoStr = `${twoMonthsAgo.getFullYear()}-${String(twoMonthsAgo.getMonth() + 1).padStart(2, '0')}`;

  // Revenue trend
  const revenueThisMonth = (db.prepare(
    "SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'paid' AND strftime('%Y-%m', paid_at) = ?"
  ).get(thisMonth) as any).total;
  const revenueLastMonth = (db.prepare(
    "SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'paid' AND strftime('%Y-%m', paid_at) = ?"
  ).get(lastMonthStr) as any).total;
  const revenueTwoMonthsAgo = (db.prepare(
    "SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'paid' AND strftime('%Y-%m', paid_at) = ?"
  ).get(twoMonthsAgoStr) as any).total;

  // Revenue by client
  const topClients = getRevenueByClient(db, 5);

  // Leads stuck in stages 7+ days
  const stuckLeads = db.prepare(`
    SELECT l.business_name, l.stage,
      CAST(julianday('now') - julianday(MAX(h.entered_at)) AS INTEGER) as days_in_stage
    FROM leads l
    JOIN lead_stage_history h ON l.id = h.lead_id
    WHERE l.stage NOT IN ('won', 'lost')
    GROUP BY l.id
    HAVING days_in_stage >= 7
    ORDER BY days_in_stage DESC
  `).all() as any[];

  // Expense trend
  const expensesThisMonth = (db.prepare(
    "SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE strftime('%Y-%m', expense_date) = ?"
  ).get(thisMonth) as any).total;
  const expensesLastMonth = (db.prepare(
    "SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE strftime('%Y-%m', expense_date) = ?"
  ).get(lastMonthStr) as any).total;

  // Avg days to payment (last 90 days)
  const avgPaymentDays = (db.prepare(`
    SELECT COALESCE(AVG(julianday(paid_at) - julianday(sent_at)), 0) as avg_days
    FROM invoices
    WHERE status = 'paid' AND paid_at >= date('now', '-90 days') AND sent_at IS NOT NULL
  `).get() as any).avg_days;

  return `Revenue trend: This month $${revenueThisMonth.toLocaleString()}, last month $${revenueLastMonth.toLocaleString()}, 2 months ago $${revenueTwoMonthsAgo.toLocaleString()}.
Top clients by revenue: ${topClients.map(c => `${c.client_name} ($${c.total.toLocaleString()})`).join(', ') || 'None'}.
Leads stuck 7+ days: ${stuckLeads.length > 0 ? stuckLeads.map(l => `${l.business_name} in ${l.stage} for ${l.days_in_stage}d`).join(', ') : 'None'}.
Expenses: This month $${expensesThisMonth.toLocaleString()}, last month $${expensesLastMonth.toLocaleString()}.
Avg days to invoice payment (90d): ${Math.round(avgPaymentDays)} days.`;
}

async function morningBriefing() {
  if (!isTwilioConfigured()) {
    console.log('Twilio not configured. Skipping morning briefing.');
    return;
  }

  const db = initDb();
  const actionItems = getActionItems(db);
  const summary = getDashboardSummary(db);

  const now = new Date();
  const isCentral = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'long' });
  const dayOfWeek = isCentral.format(now);
  const isMonday = dayOfWeek === 'Monday';

  const centralDate = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', day: 'numeric' });
  const dayOfMonth = parseInt(centralDate.format(now), 10);
  const isFirstOfMonth = dayOfMonth === 1;

  const parts: string[] = [];

  // Action items
  if (actionItems.length > 0) {
    const itemLines = actionItems.slice(0, 8).map((item, i) => `(${i + 1}) ${item.title}`);
    parts.push(`${actionItems.length} items need attention: ${itemLines.join(' ')}`);
  }

  // Monday pipeline summary
  if (isMonday) {
    parts.push(`Pipeline: ${summary.pipelineLeads} leads worth $${summary.pipelineValue.toLocaleString()}, ${summary.needsFollowUp} need follow-up`);

    // AI insights
    if (isClaudeConfigured()) {
      const insightsData = getWeeklyInsightsData(db);
      const insights = await askClaude(
        'You are a business analyst. Given this week\'s business data, provide 2-3 brief, actionable insights. Each insight must be one sentence. Focus on trends, risks, and opportunities. Be specific with numbers. Keep total response under 280 characters.',
        insightsData,
        200
      );
      if (insights) {
        parts.push(`Insights: ${insights}`);
      }
    }
  }

  // 1st of month financial summary
  if (isFirstOfMonth) {
    const lastMonth = getLastMonthStats(db);
    parts.push(`Last month: $${lastMonth.revenue.toLocaleString()} revenue, $${lastMonth.expenses.toLocaleString()} expenses, $${lastMonth.profit.toLocaleString()} profit. $${lastMonth.outstanding.toLocaleString()} outstanding`);
  }

  // Disk warnings
  const criticalDisks = getCriticalDiskReports(db);
  if (criticalDisks.length > 0) {
    const diskLines = criticalDisks.map(d => `${d.endpoint_name} ${d.mount_point} at ${d.percent_used.toFixed(0)}%`);
    parts.push(`Disk warnings: ${diskLines.join(', ')}`);
  }

  if (parts.length === 0) {
    console.log('Nothing to report. Skipping morning briefing.');
    db.close();
    return;
  }

  const message = `Good morning. ${parts.join('. ')}. Open CommandPost for details.`;

  console.log(`Sending morning briefing: ${message}`);
  const sent = await sendSms(message);

  if (sent) {
    recordAlert(db, { alert_type: 'morning_briefing', reference_id: null, message });
    console.log('Morning briefing sent.');
  } else {
    console.error('Failed to send morning briefing.');
  }

  db.close();
}

const args = process.argv.slice(2);

if (args.includes('--morning')) {
  morningBriefing().catch((err) => {
    console.error('Morning briefing failed:', err);
    process.exit(1);
  });
} else {
  console.log('Usage: npx tsx scripts/sms-alerts.ts --morning');
  process.exit(1);
}
