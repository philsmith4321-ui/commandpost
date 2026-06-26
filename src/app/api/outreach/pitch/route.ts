import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getOutreachPitch, setOutreachPitch } from '@/lib/outreach/pitch';

export async function GET() {
  const db = getDb();
  return NextResponse.json({ pitch: getOutreachPitch(db) });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || typeof body.pitch !== 'string') {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  setOutreachPitch(getDb(), body.pitch);
  return NextResponse.json({ ok: true });
}
