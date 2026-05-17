import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(request: Request) {
  const fd = await request.formData();
  const title = fd.get('title') as string;
  const content = (fd.get('content') as string) || '';

  if (!title) {
    return NextResponse.json({ error: 'Missing title' }, { status: 400 });
  }

  const db = getDb();
  db.prepare(
    "INSERT INTO scratchpad (title, content) VALUES (?, ?)"
  ).run(title, content);

  return NextResponse.json({ ok: true });
}
