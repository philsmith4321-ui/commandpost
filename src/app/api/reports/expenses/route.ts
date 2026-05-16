import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getExpenseExportData } from '@/lib/queries/report-queries';
import { generateCsv, csvResponse } from '@/lib/reports/csv';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const start = searchParams.get('start') || `${new Date().getFullYear()}-01-01`;
  const end = searchParams.get('end') || new Date().toISOString().split('T')[0];

  const db = getDb();
  const data = getExpenseExportData(db, start, end);

  const headers = ['Date', 'Category', 'Description', 'Amount', 'Client'];
  const rows = data.map(r => [
    r.expense_date,
    r.category,
    r.description,
    r.amount.toFixed(2),
    r.client_name || '',
  ]);

  const csv = generateCsv(headers, rows);
  return csvResponse(csv, `expenses-${start}-to-${end}`);
}
