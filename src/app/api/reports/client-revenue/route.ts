import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { getDb } from '@/lib/db';
import { getClientRevenueData } from '@/lib/queries/report-queries';
import { buildClientRevenuePdf } from '@/lib/reports/client-revenue-pdf';
import { generateCsv, csvResponse } from '@/lib/reports/csv';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const start = searchParams.get('start') || `${new Date().getFullYear()}-01-01`;
  const end = searchParams.get('end') || new Date().toISOString().split('T')[0];
  const format = searchParams.get('format') || 'pdf';

  const db = getDb();
  const data = getClientRevenueData(db, start, end);

  if (format === 'csv') {
    const headers = ['Client', 'Revenue', 'Invoices'];
    const rows = data.map(r => [r.client_name, r.revenue.toFixed(2), String(r.invoice_count)]);
    const csv = generateCsv(headers, rows);
    return csvResponse(csv, `client-revenue-${start}-to-${end}`);
  }

  const doc = buildClientRevenuePdf(data, start, end);
  const buffer = await renderToBuffer(doc);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="client-revenue-${start}-to-${end}.pdf"`,
    },
  });
}
