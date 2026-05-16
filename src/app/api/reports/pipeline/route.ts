import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { getDb } from '@/lib/db';
import { getPipelineReportData } from '@/lib/queries/report-queries';
import { buildPipelinePdf } from '@/lib/reports/pipeline-pdf';

export async function GET() {
  const db = getDb();
  const data = getPipelineReportData(db);
  const doc = buildPipelinePdf(data);
  const buffer = await renderToBuffer(doc);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="pipeline-report-${new Date().toISOString().split('T')[0]}.pdf"`,
    },
  });
}
