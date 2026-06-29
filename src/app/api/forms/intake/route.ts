import { NextRequest, NextResponse } from 'next/server';
import { buildTransport } from '@/lib/email/outreach-sender';

// Public intake for the rekindleleads.com website forms (contact + AI audit).
// Emails the full submission to Phil. Sends over the existing Gmail-API service
// account (DigitalOcean blocks SMTP), reused from the outreach sender.
export const maxDuration = 30;

const NOTIFY_TO = 'phil@rekindleleads.com';

// Public form intake: no cookies/credentials, so a wildcard origin is safe and
// avoids CORS preflight failures from the Bolt site (and its preview domains).
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const LABELS: Record<string, string> = {
  name: 'Name',
  email: 'Email',
  phone: 'Phone',
  company: 'Company',
  website: 'Website',
  role: 'Role',
  industry: 'Industry',
  revenue: 'Annual Revenue',
  team_size: 'Team Size',
  bottleneck: 'Biggest bottleneck',
  magic_wand: 'Automate one thing',
  tried_ai: 'Tried AI already',
  timeline: 'Timeline',
  budget: 'Budget',
  message: 'Message',
  notes: 'Anything else',
};

// Stable display order; any unknown keys are appended after these.
const ORDER = Object.keys(LABELS);

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400, headers: CORS });
  }

  const val = (k: string): string => {
    const v = (body as Record<string, unknown>)[k];
    if (typeof v === 'string') return v.trim();
    if (Array.isArray(v)) return v.filter(Boolean).join(', ');
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    return '';
  };

  const name = val('name');
  const email = val('email');
  if (!name && !email) {
    return NextResponse.json({ error: 'Name or email is required' }, { status: 400, headers: CORS });
  }

  const form = body.form === 'audit' ? 'audit' : body.form === 'contact' ? 'contact' : 'website';
  const formLabel = form === 'audit' ? 'AI Opportunity Audit' : form === 'contact' ? 'Contact Form' : 'Website Form';

  const lines: string[] = [];
  for (const k of ORDER) {
    const v = val(k);
    if (v) lines.push(`${LABELS[k]}: ${v}`);
  }
  for (const k of Object.keys(body as Record<string, unknown>)) {
    if (k === 'form' || ORDER.includes(k)) continue;
    const v = val(k);
    if (v) lines.push(`${k}: ${v}`);
  }

  // Keep the subject plain ASCII: the Gmail-API transport writes it straight into
  // the MIME header (no RFC 2047 encoding), so any non-ASCII char (e.g. an em dash)
  // shows up as mojibake. ASCII also honors Phil's no-long-dash rule.
  const subject =
    form === 'audit'
      ? `New AI Audit Request from RekindleLeads.com`
      : `New ${formLabel} from RekindleLeads.com`;
  const text = `New ${formLabel} submission from RekindleLeads.com\n\n${lines.join('\n')}\n\nSent by CommandPost form intake`;

  const sender = process.env.OUTREACH_GMAIL_SENDER || NOTIFY_TO;
  try {
    const transport = buildTransport();
    await transport.sendMail({ from: sender, to: NOTIFY_TO, subject, text });
  } catch (err) {
    console.error('[forms/intake] email send failed:', err);
    return NextResponse.json({ error: 'Could not send notification' }, { status: 502, headers: CORS });
  }

  return NextResponse.json({ ok: true }, { headers: CORS });
}
