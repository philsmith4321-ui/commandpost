import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { buildTransport } from '@/lib/email/outreach-sender';
import { runLetterBatchTick } from '@/lib/outreach/letter-batch';

export async function POST(request: NextRequest) {
  const secret = process.env.OUTREACH_CRON_SECRET;
  if (!secret || request.headers.get('x-cron-secret') !== secret)
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const from = process.env.OUTREACH_SMTP_FROM || process.env.OUTREACH_SMTP_USER;
  if (!from) return NextResponse.json({ error: 'sender not configured' }, { status: 500 });
  const body = await request.json().catch(() => ({}));
  const db = getDb();
  const result = await runLetterBatchTick(db, {
    transport: buildTransport(),
    now: new Date(),
    from,
    dryRun: body?.dryRun === true,
    to: typeof body?.to === 'string' && body.to.trim() ? body.to.trim() : undefined,
  });
  return NextResponse.json(result);
}
