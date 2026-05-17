'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ReportDatePicker } from '@/components/report-date-picker';
import { ExportButton } from '@/components/export-button';

const interactiveReports = [
  { href: '/reports/pnl', label: 'Profit & Loss Statement', description: 'Formal P&L with income, expenses by category, and monthly breakdown' },
  { href: '/reports/yearly', label: 'Yearly Summary', description: 'Annual overview with revenue, expenses, profit, hours, clients, and leads' },
  { href: '/reports/clients', label: 'Client Revenue Breakdown', description: 'Per-client revenue analysis with distribution chart and effective rates' },
  { href: '/reports/aging', label: 'Invoice Aging', description: 'Outstanding invoices grouped by aging buckets (current, 30, 60, 90+ days)' },
  { href: '/reports/snapshots', label: 'Metric Snapshots', description: 'Historical metric trends with sparkline charts' },
  { href: '/pipeline/funnel', label: 'Pipeline Funnel', description: 'Lead conversion funnel with stage counts and drop-off rates' },
  { href: '/pipeline/scores', label: 'Lead Scores', description: 'Ranked lead scoring with engagement and value breakdown' },
  { href: '/pipeline/followups', label: 'Follow-up Reminders', description: 'Overdue and upcoming lead follow-ups with snooze controls' },
  { href: '/projects/timeline', label: 'Project Timeline', description: 'Gantt-style milestone timeline across all projects' },
  { href: '/reports/utilization', label: 'Utilization Dashboard', description: 'Time utilization rates and billable efficiency by client' },
  { href: '/reports/satisfaction', label: 'Client Satisfaction / NPS', description: 'Net promoter score tracking and client feedback' },
  { href: '/reports/compare', label: 'Compare Clients', description: 'Side-by-side client comparison on revenue, hours, and health' },
  { href: '/projects/budgets', label: 'Project Budgets', description: 'Budget tracking and burn rate per project' },
  { href: '/digest', label: 'Weekly Digest', description: 'Week-at-a-glance with revenue, hours, deliverables, and upcoming tasks' },
];

const today = new Date().toISOString().split('T')[0];
const yearStart = `${new Date().getFullYear()}-01-01`;

interface ReportCard {
  title: string;
  description: string;
  formats: { label: string; format: 'csv' | 'pdf'; route: string; useDates: boolean }[];
}

const reports: ReportCard[] = [
  {
    title: 'Monthly P&L',
    description: 'Revenue, expenses by category, net profit and margin for a period.',
    formats: [
      { label: 'Download PDF', format: 'pdf', route: '/api/reports/pnl', useDates: true },
    ],
  },
  {
    title: 'Client Revenue Summary',
    description: 'Per-client revenue breakdown sorted by total, with invoice counts.',
    formats: [
      { label: 'Download PDF', format: 'pdf', route: '/api/reports/client-revenue', useDates: true },
      { label: 'Download CSV', format: 'csv', route: '/api/reports/client-revenue?format=csv', useDates: true },
    ],
  },
  {
    title: 'Expense Export',
    description: 'All expenses with date, category, description, amount, and client.',
    formats: [
      { label: 'Download CSV', format: 'csv', route: '/api/reports/expenses', useDates: true },
    ],
  },
  {
    title: 'Invoice Export',
    description: 'All invoices with status, amounts, dates, and recurring flag.',
    formats: [
      { label: 'Download CSV', format: 'csv', route: '/api/reports/invoices', useDates: true },
    ],
  },
  {
    title: 'Pipeline Report',
    description: 'Lead counts by stage, conversion rate, top deals, follow-up needs.',
    formats: [
      { label: 'Download PDF', format: 'pdf', route: '/api/reports/pipeline', useDates: false },
    ],
  },
  {
    title: 'Client Health Report',
    description: 'Health scores for all active clients grouped by status.',
    formats: [
      { label: 'Download PDF', format: 'pdf', route: '/api/reports/client-health', useDates: false },
    ],
  },
  {
    title: 'Ops Uptime Report',
    description: '30-day uptime, response times, and incidents per endpoint.',
    formats: [
      { label: 'Download PDF', format: 'pdf', route: '/api/reports/uptime', useDates: false },
    ],
  },
];

export default function ReportsPage() {
  const [start, setStart] = useState(yearStart);
  const [end, setEnd] = useState(today);

  function buildHref(route: string, useDates: boolean): string {
    if (!useDates) return route;
    const separator = route.includes('?') ? '&' : '?';
    return `${route}${separator}start=${start}&end=${end}`;
  }

  return (
    <div className="p-4 sm:p-6">
      <h2 className="text-2xl font-bold mb-4">Reports</h2>

      {/* Interactive Reports */}
      <div className="mb-8">
        <h3 className="text-sm text-gray-500 uppercase mb-3">Interactive Reports</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {interactiveReports.map(r => (
            <Link key={r.href} href={r.href}
              className="p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-blue-600 transition-colors group">
              <h3 className="text-sm font-semibold text-white group-hover:text-blue-400 mb-1">{r.label}</h3>
              <p className="text-xs text-gray-400">{r.description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Downloadable Reports */}
      <h3 className="text-sm text-gray-500 uppercase mb-3">Downloadable Reports</h3>
      <div className="mb-6">
        <p className="text-xs text-gray-500 uppercase mb-2">Date Range (for financial reports)</p>
        <ReportDatePicker onChange={(s, e) => { setStart(s); setEnd(e); }} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((report) => (
          <div key={report.title} className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
            <h3 className="text-sm font-semibold text-white mb-1">{report.title}</h3>
            <p className="text-xs text-gray-400 mb-3">{report.description}</p>
            <div className="flex gap-2">
              {report.formats.map((f) => (
                <ExportButton
                  key={f.label}
                  href={buildHref(f.route, f.useDates)}
                  label={f.label}
                  format={f.format}
                  small
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
