import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getInvoiceExportData } from '@/lib/queries/report-queries';
import { generateCsv, csvResponse } from '@/lib/reports/csv';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const start = searchParams.get('start') || `${new Date().getFullYear()}-01-01`;
  const end = searchParams.get('end') || new Date().toISOString().split('T')[0];

  const db = getDb();
  const data = getInvoiceExportData(db, start, end);

  const headers = ['Invoice #', 'Client', 'Status', 'Amount', 'Due Date', 'Sent Date', 'Paid Date', 'Recurring'];
  const rows = data.map(r => [
    r.invoice_number,
    r.client_name,
    r.status,
    r.total_amount.toFixed(2),
    r.due_date,
    r.sent_at || '',
    r.paid_at || '',
    r.is_recurring ? 'Yes' : 'No',
  ]);

  const csv = generateCsv(headers, rows);
  return csvResponse(csv, `invoices-${start}-to-${end}`);
}
