import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(request: Request) {
  const fd = await request.formData();
  const description = fd.get('description') as string;
  const amount = Number(fd.get('amount'));
  const category = fd.get('category') as string || 'other';

  if (!description || !amount) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const db = getDb();
  db.prepare(
    "INSERT INTO expenses (description, amount, category, expense_date) VALUES (?, ?, ?, date('now'))"
  ).run(description, amount, category);

  return NextResponse.json({ ok: true });
}
