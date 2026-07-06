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
rekindleleads.com
615-969-7941
Reply "no thanks" and I won't follow up.`;

// Phil's 5-email cold sequence (2026-07-06, audit-only rewrite, Phil's call).
// Every email pitches exactly one thing: the paid, guaranteed AI Opportunity
// Audit ($1,000; free if it doesn't surface $10k in opportunity; 30% credits
// toward a build). No individual builds (voice agents, reactivation, etc.) are
// pitched cold; those come after the audit, based on what the report finds.
// No em or en dashes anywhere.
export const DEFAULT_EMAIL_SEQUENCE: SequenceStep[] = [
  {
    step: 1,
    dayOffset: 0,
    subject: 'the honest version of an AI pitch',
    body: `[First Name],

You've probably been pitched "AI" by someone who has never run a business. I did it in the other order. I spent 38 years operating companies and nonprofits before I started building AI systems for businesses here in Middle Tennessee.

Here's how I work, straight. I run an AI Opportunity Audit. It's a paid, structured deep-dive that ends in a real report and a three-tier roadmap within 5 business days, not a sales call. It's $1,000, and it's guaranteed. If it doesn't surface at least $10,000 in opportunity over the next 12 months, it's free. If you decide to build, 30% of the fee comes off the build.

Worth a look for [Company]? Just reply "tell me more" and I'll send the details.

${FOOTER}`,
  },
  {
    step: 2,
    dayOffset: 3,
    subject: 'why I charge for what others give away',
    body: `[First Name],

Plenty of people will offer [Company] a free AI consultation. I don't, and here's why.

A free assessment is a sales call with a costume on. The advice always points at whatever the seller wants to build. I charge $1,000 for my AI Opportunity Audit because the report is the product: a structured deep-dive into your operation and a three-tier roadmap, in your hands within 5 business days.

And it's guaranteed. If it doesn't surface at least $10,000 in opportunity over the next 12 months, it's free.

Reply "tell me more" and I'll send the details.

${FOOTER}`,
  },
  {
    step: 3,
    dayOffset: 7,
    subject: 'what the audit actually looks like',
    body: `[First Name],

A quick, concrete picture of the AI Opportunity Audit, since "audit" can mean anything these days.

I spend real time in your operation: how work comes in, where hours leak, what's being retyped, chased, or dropped. Within 5 business days you get a written report and a three-tier roadmap: what to do first, what to do next, and what to skip because it wouldn't earn its keep at [Company].

The roadmap is yours to keep. Build with me, build with someone else, or build nothing. It's $1,000, and if the report doesn't surface at least $10,000 in opportunity over the next 12 months, it's free. If you do build with me, 30% of the fee comes off the build.

Reply "tell me more" and I'll send the details.

${FOOTER}`,
  },
  {
    step: 4,
    dayOffset: 11,
    subject: 'what if the audit turns up nothing?',
    body: `[First Name],

The question I'd be asking in your chair: what if the audit turns up nothing?

Then you don't pay. That's the whole guarantee. If my AI Opportunity Audit doesn't surface at least $10,000 in opportunity over the next 12 months, documented in the report, the $1,000 fee is refunded. I can offer that because in 38 years of running businesses I never walked into one that didn't have at least that much sitting in missed follow-up, retyped paperwork, or slow handoffs.

Worst case, it costs you nothing and you learn where you stand. Best case, the roadmap pays for itself many times over, and 30% of the fee comes off the build if you move forward.

If [Company] is worth a look, reply "tell me more."

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

1. The offer stands whenever you're ready: an AI Opportunity Audit for $1,000, a real report and three-tier roadmap in 5 business days, free if it doesn't surface at least $10,000 in opportunity.

2. If it's not for [Company] but you know an owner who's stretched thin, I'd count it a favor if you passed my name along.

Either way, I'm rooting for you. No hype, just results.

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
