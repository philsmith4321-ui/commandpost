import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue; }
      current += char;
    }
    values.push(current.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return row;
  });
}

export async function POST(request: Request) {
  const fd = await request.formData();
  const type = fd.get('type') as string;
  const file = fd.get('file') as File;
  if (!type || !file) {
    return NextResponse.json({ error: 'Missing type or file' }, { status: 400 });
  }

  const text = await file.text();
  const rows = parseCSV(text);
  if (rows.length === 0) {
    return NextResponse.json({ error: 'No data rows found' }, { status: 400 });
  }

  const db = getDb();
  let imported = 0;

  if (type === 'clients') {
    const stmt = db.prepare(
      "INSERT INTO clients (name, contact_person, email, phone, notes, source, status, monthly_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    for (const row of rows) {
      if (!row.name) continue;
      stmt.run(
        row.name,
        row.contact_person || null,
        row.email || null,
        row.phone || null,
        row.notes || null,
        row.source || null,
        row.status || 'active',
        row.monthly_value ? Number(row.monthly_value) : null
      );
      imported++;
    }
  } else if (type === 'expenses') {
    const stmt = db.prepare(
      "INSERT INTO expenses (description, amount, category, expense_date) VALUES (?, ?, ?, ?)"
    );
    for (const row of rows) {
      if (!row.description || !row.amount) continue;
      const category = ['servers', 'software', 'contractor', 'marketing', 'other'].includes(row.category) ? row.category : 'other';
      stmt.run(
        row.description,
        Number(row.amount),
        category,
        row.expense_date || new Date().toISOString().split('T')[0]
      );
      imported++;
    }
  } else if (type === 'leads') {
    const stmt = db.prepare(
      "INSERT INTO leads (business_name, contact_person, email, phone, website, source, estimated_value, stage) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    for (const row of rows) {
      if (!row.business_name) continue;
      const source = ['referral', 'website', 'outbound', 'other'].includes(row.source) ? row.source : 'other';
      const stage = ['new', 'contacted', 'discovery', 'proposal', 'negotiating', 'won', 'lost'].includes(row.stage) ? row.stage : 'new';
      stmt.run(
        row.business_name,
        row.contact_person || null,
        row.email || null,
        row.phone || null,
        row.website || null,
        source,
        row.estimated_value ? Number(row.estimated_value) : null,
        stage
      );
      imported++;
    }
  } else {
    return NextResponse.json({ error: `Import type '${type}' not supported` }, { status: 400 });
  }

  return NextResponse.json({ ok: true, imported });
}
