import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getEmailSequence } from '@/lib/outreach/sequence';
import {
  enroll, unenroll, enrollAllEligible, listEnrolled, listEligible, eligibleCount, retrySequenceStep,
} from '@/lib/queries/sequence-queries';

export async function GET() {
  const db = getDb();
  const eligible = listEligible(db);
  return NextResponse.json({
    steps: getEmailSequence(db),
    enrolled: listEnrolled(db),
    eligible,
    eligibleCount: eligibleCount(db),
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  const db = getDb();
  if (body.action === 'enroll-all') {
    return NextResponse.json({ ok: true, enrolled: enrollAllEligible(db) });
  }
  if (body.action === 'enroll-many') {
    const ids = Array.isArray(body.leadIds)
      ? (body.leadIds as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n > 0)
      : [];
    if (!ids.length) return NextResponse.json({ error: 'invalid leadIds' }, { status: 400 });
    for (const leadId of ids) enroll(db, leadId);
    return NextResponse.json({ ok: true, enrolled: ids.length });
  }
  const id = Number(body.leadId);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'invalid leadId' }, { status: 400 });
  switch (body.action) {
    case 'enroll': enroll(db, id); break;
    case 'unenroll': unenroll(db, id); break;
    case 'retry': retrySequenceStep(db, id); break;
    default: return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
