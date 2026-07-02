import type Database from 'better-sqlite3';
import { getSetting, setSetting } from '@/lib/queries/settings-queries';

// The app_settings key under which the operator's editable 5-email sequence lives.
export const EMAIL_SEQUENCE_KEY = 'email_sequence';

export interface SequenceStep {
  step: number;      // 1-based position in the sequence
  dayOffset: number; // days after enrollment this step becomes due
  subject: string;
  body: string;      // [First Name] / [Company] merge fields; footer included
}

const FOOTER = `Phil Smith
RekindleLeads.com, 615-969-7941
Reply "no thanks" and I won't follow up.`;

// Phil's approved 5-email cold sequence (2026-07-01, pitch kit v5 aligned).
// Cold touches earn a reply; the audit appears only in step 4, guarantee first,
// price withheld until the prospect engages. No em or en dashes anywhere.
export const DEFAULT_EMAIL_SEQUENCE: SequenceStep[] = [
  {
    step: 1,
    dayOffset: 0,
    subject: 'the honest version of an AI pitch',
    body: `[First Name],

You've probably been pitched "AI" by someone who has never run a business. I did it in the other order. I spent 38 years operating companies and nonprofits before I started building AI systems for businesses here in Middle Tennessee.

So I care less about what's trendy and more about what earns its keep. And I'll tell you straight when AI isn't the answer yet.

I build the thing too, not just advise. Custom software, agents, automations, not a chatbot wrapper. One client, a multi-location healthcare practice, tripled its consultation booking rate. Another cut content production time about 80%.

Worth a short conversation about where that would actually pay off at [Company]? Just reply and I'll send a couple of times.

${FOOTER}`,
  },
  {
    step: 2,
    dayOffset: 3,
    subject: "who answers when you can't pick up?",
    body: `[First Name],

Quick question about [Company]: what happens to a call that comes in while your hands are full?

Here's what I see over and over in home services. The customer doesn't leave a voicemail. They call the next name on the list, and the business that answers first wins the job. You paid to make that phone ring, and a competitor got the work.

I build systems that answer every call, day or night, book the job, and text you the details. Not a robot reading a script, an actual conversation. One saved job a month usually covers the whole thing.

If you'd like, reply and I'll show you roughly how many calls a shop your size is losing. Takes five minutes.

${FOOTER}`,
  },
  {
    step: 3,
    dayOffset: 7,
    subject: "the cheapest customer you'll ever get",
    body: `[First Name],

The cheapest customer you'll ever get is one who already knows you.

Every business I've walked into has the same asset gathering dust: old quotes that never closed, past customers who haven't been back, leads that went quiet. That list is worth real money, and most owners never touch it because follow-up is tedious and nobody has time.

That's exactly the kind of work I automate. Systems that follow up with every old lead and past customer, personally and politely, until they book or say no. No new ad spend. Just revenue recovered from work you already did.

Curious what's sitting in your list at [Company]? Reply and I'll walk you through how I'd find out.

${FOOTER}`,
  },
  {
    step: 4,
    dayOffset: 11,
    subject: 'sometimes the answer is "don\'t buy AI yet"',
    body: `[First Name],

Something I tell owners that surprises them: sometimes AI isn't the answer yet, and I'd rather say so than sell you something that won't earn its keep.

So here's how I work, straight. I start with an AI Opportunity Audit. It's a structured deep-dive into your operation that ends in a real report and a three-tier roadmap within 5 business days, not a sales call. And it's guaranteed: if it doesn't surface at least $10,000 in opportunity over the next 12 months, documented in the report, you don't pay a dime. If you build with me after, 30% of the audit fee comes off the build.

I only take on a few of these a month because I do them myself.

If [Company] might be worth a look, just reply "tell me more" and I'll send the details.

${FOOTER}`,
  },
  {
    step: 5,
    dayOffset: 15,
    subject: 'closing the loop',
    body: `[First Name],

I've sent a few notes and don't want to be that guy, so this is my last one.

If the timing's wrong, no problem at all. Business owners' plates are full, I ran companies for 38 years and I remember.

Two things before I go:

1. If a slow season, a missed-call problem, or a pile of old leads ever makes you think "there's got to be a better way," my number is below. That's usually when a 15-minute call is worth it.

2. If this isn't for you but you know an owner wrestling with phones, follow-up, or too much paperwork, I'd count it a favor if you passed my name along.

Either way, I'm rooting for [Company]. No hype, just results.

${FOOTER}`,
  },
];

function isValidStep(s: unknown): s is SequenceStep {
  if (!s || typeof s !== 'object') return false;
  const o = s as Record<string, unknown>;
  return (
    typeof o.step === 'number' && typeof o.dayOffset === 'number' &&
    typeof o.subject === 'string' && typeof o.body === 'string'
  );
}

// Operator override from app_settings, else the approved default. A malformed
// override falls back to the default rather than breaking the send loop.
export function getEmailSequence(db: Database.Database): SequenceStep[] {
  const raw = getSetting(db, EMAIL_SEQUENCE_KEY);
  if (!raw) return DEFAULT_EMAIL_SEQUENCE;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isValidStep)) {
      return [...(parsed as SequenceStep[])].sort((a, b) => a.step - b.step);
    }
  } catch { /* fall through */ }
  return DEFAULT_EMAIL_SEQUENCE;
}

export function setEmailSequence(db: Database.Database, steps: SequenceStep[]): void {
  setSetting(db, EMAIL_SEQUENCE_KEY, JSON.stringify(steps));
}

export interface MergeLead { business_name: string | null; contact_person: string | null; }

// First word of the contact name, if we actually have one. Never invent a name.
export function leadFirstName(l: MergeLead): string | null {
  const first = (l.contact_person ?? '').trim().split(/\s+/)[0] ?? '';
  return first.length > 1 && /^[A-Za-z]/.test(first) ? first : null;
}

// Fill merge fields for one lead. When no first name is on file the salutation
// line is dropped entirely (pitch rule: never invent a first name) and inline
// mentions fall back to "there"; [Company] falls back to "your business".
export function renderSequenceEmail(
  stepDef: SequenceStep,
  lead: MergeLead
): { subject: string; body: string } {
  const first = leadFirstName(lead);
  const company = (lead.business_name ?? '').trim() || 'your business';
  let body = stepDef.body;
  if (first) {
    body = body.replaceAll('[First Name]', first);
  } else {
    body = body
      .split('\n')
      .filter((line) => line.trim() !== '[First Name],')
      .join('\n')
      .replace(/^\n+/, '')
      .replaceAll('[First Name]', 'there');
  }
  body = body.replaceAll('[Company]', company);
  const subject = stepDef.subject
    .replaceAll('[First Name]', first ?? 'there')
    .replaceAll('[Company]', company);
  return { subject, body };
}
