import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { listByTab, approve, skip, unqueue, retry, editDraft, setDoNotEmail, type Tab } from '@/lib/queries/outreach-email-queue-queries';

const TABS: Tab[] = ['review', 'queued', 'sent'];

export async function GET(request: NextRequest) {
  const db = getDb();
  const tab = (request.nextUrl.searchParams.get('tab') || 'review') as Tab;
  const safe: Tab = TABS.includes(tab) ? tab : 'review';
  const counts = {
    review: listByTab(db, 'review').length,
    queued: listByTab(db, 'queued').length,
    sent: listByTab(db, 'sent').length,
  };
  return NextResponse.json({ tab: safe, leads: listByTab(db, safe), counts });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  const id = Number(body.leadId);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'invalid leadId' }, { status: 400 });
  const db = getDb();
  switch (body.action) {
    case 'approve': approve(db, id); break;
    case 'skip': skip(db, id); break;
    case 'unqueue': unqueue(db, id); break;
    case 'retry': retry(db, id); break;
    case 'edit':
      if (typeof body.body !== 'string') return NextResponse.json({ error: 'invalid body text' }, { status: 400 });
      editDraft(db, id, body.body); break;
    case 'do-not-email': setDoNotEmail(db, id, !!body.on); break;
    default: return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
