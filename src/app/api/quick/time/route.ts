import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(request: Request) {
  const fd = await request.formData();
  const description = fd.get('description') as string;
  const duration_minutes = Number(fd.get('duration_minutes'));
  const hourly_rate = Number(fd.get('hourly_rate'));

  if (!description || !duration_minutes || !hourly_rate) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const db = getDb();

  // Get first project to attach to (or create a general one)
  let project = db.prepare("SELECT id FROM projects LIMIT 1").get() as { id: number } | undefined;
  if (!project) {
    const client = db.prepare("SELECT id FROM clients WHERE deleted_at IS NULL LIMIT 1").get() as { id: number } | undefined;
    if (!client) {
      return NextResponse.json({ error: 'No clients exist' }, { status: 400 });
    }
    const result = db.prepare("INSERT INTO projects (client_id, name) VALUES (?, 'General')").run(client.id);
    project = { id: Number(result.lastInsertRowid) };
  }

  db.prepare(
    "INSERT INTO time_entries (project_id, description, duration_minutes, entry_date, hourly_rate) VALUES (?, ?, ?, date('now'), ?)"
  ).run(project.id, description, duration_minutes, hourly_rate);

  return NextResponse.json({ ok: true });
}
