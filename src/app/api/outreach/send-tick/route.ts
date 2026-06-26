import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { buildTransport, sendOneTick } from '@/lib/email/outreach-sender';

export async function POST(request: NextRequest) {
  const secret = process.env.OUTREACH_CRON_SECRET;
  if (!secret || request.headers.get('x-cron-secret') !== secret)
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const from = process.env.OUTREACH_SMTP_FROM || process.env.OUTREACH_SMTP_USER;
  if (!from) return NextResponse.json({ error: 'sender not configured' }, { status: 500 });
  const db = getDb();
  const result = await sendOneTick(db, { transport: buildTransport(), now: new Date(), from });
  return NextResponse.json(result);
}
