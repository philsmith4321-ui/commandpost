'use client';

import { useState } from 'react';
import { ReportDatePicker } from '@/components/report-date-picker';
import { ExportButton } from '@/components/export-button';

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
