import { describe, it, expect } from 'vitest';
import React from 'react';

describe('PDF document builders', () => {
  it('buildPnlPdf returns a React element', async () => {
    const { buildPnlPdf } = await import('@/lib/reports/pnl-pdf');
    const doc = buildPnlPdf({
      revenue: 10000,
      totalExpenses: 3000,
      profit: 7000,
      expensesByCategory: [
        { category: 'servers', amount: 2000 },
        { category: 'software', amount: 1000 },
      ],
    }, '2026-05-01', '2026-05-31');
    expect(doc).toBeDefined();
    expect(React.isValidElement(doc)).toBe(true);
  });

  it('buildClientRevenuePdf returns a React element', async () => {
    const { buildClientRevenuePdf } = await import('@/lib/reports/client-revenue-pdf');
    const doc = buildClientRevenuePdf([
      { client_name: 'Client A', revenue: 5000, invoice_count: 3 },
    ], '2026-05-01', '2026-05-31');
    expect(React.isValidElement(doc)).toBe(true);
  });

  it('buildPipelinePdf returns a React element', async () => {
    const { buildPipelinePdf } = await import('@/lib/reports/pipeline-pdf');
    const doc = buildPipelinePdf({
      totalActiveLeads: 5,
      totalActiveValue: 50000,
      conversionRate: 40,
      averageDealValue: 10000,
      needsFollowUp: 2,
      stageBreakdown: [{ stage: 'new', count: 2, value: 20000 }],
      topLeads: [{ business_name: 'Lead A', stage: 'new', estimated_value: 10000 }],
    });
    expect(React.isValidElement(doc)).toBe(true);
  });

  it('buildClientHealthPdf returns a React element', async () => {
    const { buildClientHealthPdf } = await import('@/lib/reports/client-health-pdf');
    const doc = buildClientHealthPdf([
      { clientId: 1, clientName: 'Client A', score: 85, status: 'healthy' as const, payment: 40, balance: 30, engagement: 15 },
    ]);
    expect(React.isValidElement(doc)).toBe(true);
  });

  it('buildUptimePdf returns a React element', async () => {
    const { buildUptimePdf } = await import('@/lib/reports/uptime-pdf');
    const doc = buildUptimePdf([
      { name: 'API', url: 'https://api.example.com', uptime_percent: 99.9, avg_response_ms: 200, incident_count: 1, recent_incidents: [] },
    ]);
    expect(React.isValidElement(doc)).toBe(true);
  });
});
