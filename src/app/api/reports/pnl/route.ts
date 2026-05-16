import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { getDb } from '@/lib/db';
import { getPnlData } from '@/lib/queries/report-queries';
import { buildPnlPdf } from '@/lib/reports/pnl-pdf';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const start = searchParams.get('start') || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;
  const end = searchParams.get('end') || new Date().toISOString().split('T')[0];

  const db = getDb();
  const data = getPnlData(db, start, end);
  const doc = buildPnlPdf(data, start, end);
  const buffer = await renderToBuffer(doc);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="pnl-${start}-to-${end}.pdf"`,
    },
  });
}
