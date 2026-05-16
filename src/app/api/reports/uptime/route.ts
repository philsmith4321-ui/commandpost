import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { getDb } from '@/lib/db';
import { getUptimeReportData } from '@/lib/queries/report-queries';
import { buildUptimePdf } from '@/lib/reports/uptime-pdf';

export async function GET() {
  const db = getDb();
  const data = getUptimeReportData(db);
  const doc = buildUptimePdf(data);
  const buffer = await renderToBuffer(doc);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="uptime-report-${new Date().toISOString().split('T')[0]}.pdf"`,
    },
  });
}
