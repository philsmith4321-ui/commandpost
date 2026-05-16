import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

function toCsv(rows: Record<string, any>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(','));
  }
  return lines.join('\n');
}

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type');
  const db = getDb();
  let rows: Record<string, any>[] = [];
  let filename = 'export.csv';

  switch (type) {
    case 'clients':
      rows = db.prepare(`
        SELECT id, name, contact_person, email, phone, status, monthly_value, source, created_at
        FROM clients WHERE deleted_at IS NULL ORDER BY name
      `).all() as any[];
      filename = 'clients.csv';
      break;

    case 'invoices':
      rows = db.prepare(`
        SELECT i.invoice_number, c.name as client, i.status, i.total_amount, i.due_date, i.sent_at, i.paid_at, i.created_at
        FROM invoices i JOIN clients c ON i.client_id = c.id
        ORDER BY i.created_at DESC
      `).all() as any[];
      filename = 'invoices.csv';
      break;

    case 'time':
      rows = db.prepare(`
        SELECT te.entry_date, c.name as client, p.name as project, te.description, te.duration_minutes, te.hourly_rate,
          ROUND(te.duration_minutes * te.hourly_rate / 60.0, 2) as amount, CASE WHEN te.is_invoiced THEN 'Yes' ELSE 'No' END as invoiced
        FROM time_entries te
        JOIN projects p ON te.project_id = p.id
        JOIN clients c ON p.client_id = c.id
        ORDER BY te.entry_date DESC
      `).all() as any[];
      filename = 'time-entries.csv';
      break;

    case 'expenses':
      rows = db.prepare(`
        SELECT e.expense_date, e.category, e.description, e.amount, COALESCE(c.name, 'N/A') as client
        FROM expenses e LEFT JOIN clients c ON e.client_id = c.id
        ORDER BY e.expense_date DESC
      `).all() as any[];
      filename = 'expenses.csv';
      break;

    case 'leads':
      rows = db.prepare(`
        SELECT business_name, contact_person, email, phone, source, stage, estimated_value, follow_up_date, created_at
        FROM leads ORDER BY created_at DESC
      `).all() as any[];
      filename = 'leads.csv';
      break;

    default:
      return NextResponse.json({ error: 'Invalid type. Use: clients, invoices, time, expenses, leads' }, { status: 400 });
  }

  const csv = toCsv(rows);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
