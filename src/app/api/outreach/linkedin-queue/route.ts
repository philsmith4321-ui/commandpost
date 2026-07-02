import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { listLinkedInQueue } from '@/lib/queries/linkedin-queue-queries';

// Read-only: the cockpit's write actions (log-touch, save-draft, draft) go
// through the existing /api/outreach/leads route.
export async function GET() {
  const db = getDb();
  const all = listLinkedInQueue(db);
  return NextResponse.json({
    queue: all.filter((l) => !l.linkedin_sent_at && !l.replied_at),
    sentCount: all.filter((l) => !!l.linkedin_sent_at).length,
  });
}
