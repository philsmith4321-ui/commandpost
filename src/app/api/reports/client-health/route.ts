import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { getDb } from '@/lib/db';
import { getClientHealthSummary } from '@/lib/queries/client-queries';
import { buildClientHealthPdf } from '@/lib/reports/client-health-pdf';

export async function GET() {
  const db = getDb();
  const clients = getClientHealthSummary(db);
  const doc = buildClientHealthPdf(clients);
  const buffer = await renderToBuffer(doc);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="client-health-${new Date().toISOString().split('T')[0]}.pdf"`,
    },
  });
}
