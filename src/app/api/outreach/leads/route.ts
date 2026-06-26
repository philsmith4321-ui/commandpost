import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { isLaneId } from '@/lib/outreach/lanes';
import {
  listLeadsByLane,
  laneLeadCounts,
  laneFacets,
  logTouch,
  clearTouch,
  markReplied,
  setFollowUp,
  addLeadNote,
  updateLeadContact,
  saveDraft,
  type ContactPatch,
  type OutreachLead,
} from '@/lib/queries/outreach-lead-queries';
import { isBucketKey, type BucketKey } from '@/lib/outreach/employee-size';
import { generateDraft } from '@/lib/outreach/draft';
import type { OutreachChannel } from '@/lib/types';

export async function GET(request: NextRequest) {
  const db = getDb();
  const sp = request.nextUrl.searchParams;
  const laneParam = sp.get('lane');
  const lane = isLaneId(laneParam) ? laneParam : 'hunter';

  const sizes = (sp.get('sizes') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(isBucketKey) as BucketKey[];
  const nearZip = (sp.get('nearZip') || '').trim() || undefined;
  const milesRaw = Number(sp.get('withinMiles'));
  const withinMiles = nearZip && Number.isFinite(milesRaw) && milesRaw > 0 ? milesRaw : undefined;

  const leads = listLeadsByLane(db, lane, {
    stage: sp.get('stage') || undefined,
    uncontactedOnly: sp.get('uncontacted') === '1',
    segment: sp.get('segment') || undefined,
    category: sp.get('category') || undefined,
    city: sp.get('city') || undefined,
    sizes: sizes.length ? sizes : undefined,
    nearZip,
    withinMiles,
  });
  const counts = laneLeadCounts(db, lane);
  const facets = laneFacets(db, lane);
  return NextResponse.json({ lane, leads, counts, facets });
}

const CHANNELS: OutreachChannel[] = ['letter', 'email', 'phone', 'linkedin', 'fb'];
const DRAFTABLE: OutreachChannel[] = ['letter', 'email', 'linkedin', 'fb'];

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
      const sentAt =
        typeof body.sentAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.sentAt) ? body.sentAt : null;
      logTouch(db, leadId, body.channel, typeof body.note === 'string' ? body.note : null, sentAt);
      break;
    }
    case 'clear-touch': {
      if (!CHANNELS.includes(body.channel)) {
        return NextResponse.json({ error: 'invalid channel' }, { status: 400 });
      }
      clearTouch(db, leadId, body.channel);
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
    case 'draft': {
      if (!DRAFTABLE.includes(body.channel)) {
        return NextResponse.json({ error: 'invalid channel' }, { status: 400 });
      }
      const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId) as OutreachLead | undefined;
      if (!lead) {
        return NextResponse.json({ error: 'lead not found' }, { status: 404 });
      }
      const draft = await generateDraft(db, lead, body.channel);
      if (draft == null) {
        return NextResponse.json({ error: 'generation failed' }, { status: 502 });
      }
      saveDraft(db, leadId, body.channel, draft);
      return NextResponse.json({ ok: true, draft });
    }
    case 'save-draft': {
      if (!DRAFTABLE.includes(body.channel)) {
        return NextResponse.json({ error: 'invalid channel' }, { status: 400 });
      }
      if (typeof body.body !== 'string') {
        return NextResponse.json({ error: 'invalid body' }, { status: 400 });
      }
      saveDraft(db, leadId, body.channel, body.body);
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
