import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { isLaneId } from '@/lib/outreach/lanes';
import {
  listLeadsByLane,
  laneLeadCounts,
  logTouch,
  markReplied,
  setFollowUp,
  addLeadNote,
  updateLeadContact,
  type ContactPatch,
} from '@/lib/queries/outreach-lead-queries';
import type { OutreachChannel } from '@/lib/types';

export async function GET(request: NextRequest) {
  const db = getDb();
  const sp = request.nextUrl.searchParams;
  const laneParam = sp.get('lane');
  const lane = isLaneId(laneParam) ? laneParam : 'hunter';
  const stage = sp.get('stage') || undefined;
  const uncontactedOnly = sp.get('uncontacted') === '1';
  const leads = listLeadsByLane(db, lane, { stage, uncontactedOnly });
  const counts = laneLeadCounts(db, lane);
  return NextResponse.json({ lane, leads, counts });
}

const CHANNELS: OutreachChannel[] = ['letter', 'email', 'phone'];

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const leadId = Number(body.leadId);
  if (!Number.isInteger(leadId) || leadId <= 0) {
    return NextResponse.json({ error: 'invalid leadId' }, { status: 400 });
  }
  const db = getDb();

  switch (body.action) {
    case 'log-touch': {
      if (!CHANNELS.includes(body.channel)) {
        return NextResponse.json({ error: 'invalid channel' }, { status: 400 });
      }
      logTouch(db, leadId, body.channel, typeof body.note === 'string' ? body.note : null);
      break;
    }
    case 'mark-replied':
      markReplied(db, leadId);
      break;
    case 'set-followup':
      setFollowUp(db, leadId, typeof body.date === 'string' ? body.date : null);
      break;
    case 'add-note': {
      const note = typeof body.note === 'string' ? body.note.trim() : '';
      if (!note) return NextResponse.json({ error: 'empty note' }, { status: 400 });
      addLeadNote(db, leadId, note);
      break;
    }
    case 'update-contact': {
      const fields: (keyof ContactPatch)[] = ['email', 'phone', 'street', 'city', 'state', 'postal_code'];
      const patch: ContactPatch = {};
      for (const f of fields) {
        if (f in body) patch[f] = typeof body[f] === 'string' ? body[f] : null;
      }
      updateLeadContact(db, leadId, patch);
      break;
    }
    default:
      return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
