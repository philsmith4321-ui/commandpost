import type Database from 'better-sqlite3';
import { getSetting, setSetting } from '@/lib/queries/settings-queries';

// The app_settings key under which the operator's editable outreach pitch lives.
export const OUTREACH_PITCH_KEY = 'outreach_pitch';

// Phil Smith / RekindleLeads' approved cold-outreach pitch kit. This is the voice
// source of truth handed to the model when drafting; the operator can override it
// (stored under OUTREACH_PITCH_KEY) but this is the fallback.
export const DEFAULT_OUTREACH_PITCH = `RekindleLeads — Cold Outreach Pitch Kit (Operator Angle)

VOICE: anti-hype, operator-first, honest. Phil Smith spent 38 years running businesses before building AI systems for SMBs in Middle Tennessee. He cares less about what's trendy and more about what actually cuts cost or brings in work — and he says so plainly when AI isn't the answer yet.

OFFER: a FREE 30–60 minute business assessment. He maps the operation, finds the one or two places AI would genuinely pay off, and hands over a written roadmap with real numbers — yours to keep, no obligation, whether you ever work together or not.

TAGLINE (use in every channel): "We focus on cutting costs, streamlining processes and fueling growth!"

PROOF NUMBER — match it to the recipient's industry:
- RIA / financial advisor → cut a major time-sink ~80%
- Chiropractic → tripled (3x) bookings
- Nonprofit → 4x grants
- Anything else → use a recent client cut a major time-sink ~80% / another tripled bookings.

CONTACT: Phil Smith, RekindleLeads · 615-969-7941 · rekindleleads.com

----- CHANNEL TEMPLATES (voice reference — personalize, don't copy verbatim) -----

HANDWRITTEN LETTER (reads human; one short page; never mention automation):
[First Name], You've probably been pitched "AI" a few times already, usually by someone who's never made payroll or sweated a slow month. That's the part that bugs me. I'm Phil Smith. I spent 38 years running businesses before I started building AI systems, so I care less about what's trendy and more about what actually cuts cost or brings in work. Sometimes that's AI. Sometimes it isn't and I'll tell you straight when it isn't. Here's my offer: a free business assessment. 30–60 minutes, I map your operation, find the one or two places AI would genuinely pay off and hand you a written roadmap with real numbers. It's yours to keep whether we ever work together or not. We focus on cutting costs, streamlining processes and fueling growth! If that's worth a conversation, my number's below. Phil Smith, RekindleLeads. 615-969-7941 rekindleleads.com.

COLD EMAIL (the subject line is most of the job; strongest subject: "the honest version of an AI pitch"; keep a CAN-SPAM opt-out line + mailing address):
[First Name] — You've probably been pitched "AI" by people who've never run a business. I did the opposite order: 38 years operating companies first, then I started building AI systems for SMBs here in Middle Tennessee. That background means I care less about what's trendy and more about what actually cuts cost or brings in work and I'll tell you honestly when AI isn't the answer yet. My offer: a free 30–60 minute assessment. I map your operation, find the highest-ROI opportunity, and hand you a written roadmap with real numbers yours to keep, no obligation. One recent client cut a major time-sink ~80%; another tripled bookings. We focus on cutting costs, streamlining processes and fueling growth! Worth 30 minutes? Reply and I'll send a couple of times. Phil Smith, RekindleLeads · rekindleleads.com · 615-969-7941. [Mailing address] — Reply "no thanks" and I won't follow up.

LINKEDIN connection-request note (300-character limit, NO links): "Phil here I spent 38 years running businesses before I started building AI systems for small and medium size businesses in Middle TN. Not pitching. I do a free assessment that finds where AI actually pays off (or tells you it doesn't yet), roadmap yours to keep. We focus on cutting costs, streamlining processes and fueling growth! Mind if I connect?"

LINKEDIN first DM after connecting: "Thanks for connecting, [First Name]. Straight to it: most "AI" pitches come from people who've never run a business. I ran them for 38 years before I built this. I do a free 30-min assessment to find the one or two places AI genuinely cuts cost or unlocks growth in your operation, hand you a roadmap, no obligation. We focus on cutting costs, streamlining processes and fueling growth! Worth a look?"

FACEBOOK MESSENGER: mirror the LinkedIn first-DM voice — casual and brief, no links.`;

export function getOutreachPitch(db: Database.Database): string {
  return getSetting(db, OUTREACH_PITCH_KEY) ?? DEFAULT_OUTREACH_PITCH;
}

export function setOutreachPitch(db: Database.Database, text: string): void {
  setSetting(db, OUTREACH_PITCH_KEY, text);
}
