import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getDueRecurringTasks, markTaskGenerated } from '@/lib/queries/recurring-task-queries';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const dueTasks = getDueRecurringTasks(db);
  let created = 0;

  for (const task of dueTasks) {
    if (task.project_id) {
      // Create as deliverable
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);
      db.prepare(
        'INSERT INTO deliverables (project_id, title, status, due_date) VALUES (?, ?, ?, ?)'
      ).run(task.project_id, task.title, 'not_started', dueDate.toISOString().split('T')[0]);
    } else {
      // Create as activity log reminder
      db.prepare(
        'INSERT INTO activity_logs (client_id, content) VALUES (?, ?)'
      ).run(task.client_id, `[Recurring] ${task.title}`);
    }
    markTaskGenerated(db, task.id);
    created++;
  }

  return NextResponse.json({ ok: true, generated: created });
}
