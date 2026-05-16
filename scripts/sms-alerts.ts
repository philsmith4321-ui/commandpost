import { initDb } from '../src/lib/db';
import { isTwilioConfigured, sendSms } from '../src/lib/twilio';
import { recordAlert } from '../src/lib/queries/alert-queries';
import { getActionItems, getDashboardSummary } from '../src/lib/queries/dashboard-queries';
import { getCriticalDiskReports } from '../src/lib/queries/disk-report-queries';

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
