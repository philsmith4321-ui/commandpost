import type Database from 'better-sqlite3';
import type { OutreachChannel } from '@/lib/types';
import type { OutreachLead } from '@/lib/queries/outreach-lead-queries';
import { askClaude } from '@/lib/claude';
import { LANES, isLaneId } from '@/lib/outreach/lanes';
import { getOutreachPitch } from './pitch';
import { usableResearch } from '@/lib/outreach/research';

// Per-channel shaping: the instruction handed to the model + a token budget.
// Phil's physical mailing address, required in the cold-email footer for CAN-SPAM.
// Single source of truth — change it here if the business address ever changes.
export const MAILING_ADDRESS = '1004 Thistle Court, Hendersonville, TN 37075';

const CHANNEL_INSTRUCTIONS: Record<Exclude<OutreachChannel, 'phone'>, { instruction: string; maxTokens: number }> = {
  letter: {
    instruction:
      'Channel: HANDWRITTEN LETTER. Write a warm, human note that reads like it was written by hand. HARD LENGTH LIMIT: the whole letter must fit handwritten on a 5x7 card, so keep the body 100-125 words, never more than 130 (signature lines not counted). Any personalized or researched detail you weave in counts against that budget; make room by cutting elsewhere, never by running long. Every sentence earning its place, no filler. Never mention automation, "AI tools," or anything that breaks the handwritten illusion. Operator voice, plain and direct. Sign off exactly with these three lines: "Phil Smith" on the first line, "rekindleleads.com" on the second line, "615-969-7941" on the third line.',
    maxTokens: 700,
  },
  email: {
    instruction:
      `Channel: COLD EMAIL. Output a "Subject: ..." line first, then a blank line, then the body. The subject line carries most of the weight — make it honest and intriguing (e.g. "the honest version of an AI pitch"). Keep the body short. Sign off exactly with these three lines: "Phil Smith" on the first line, "rekindleleads.com" on the second line, "615-969-7941" on the third line. For CAN-SPAM, the footer MUST include the physical mailing address verbatim: ${MAILING_ADDRESS}. Never output a placeholder like "[Mailing address]" — always use that exact address. End with the opt-out line: "Reply 'no thanks' and I won't follow up."`,
    maxTokens: 1024,
  },
  linkedin: {
    instruction:
      'Channel: LINKEDIN connection-request note. STRICTLY UNDER 300 characters total. No links, no URLs, no phone numbers. Casual, anti-hype, one ask to connect. Stay under the 300-character limit even if it means trimming.',
    maxTokens: 400,
  },
  fb: {
    instruction:
      'Channel: FACEBOOK MESSENGER direct message. Brief and casual, mirroring the LinkedIn first-DM voice. No links, no URLs. Get straight to the free-assessment offer in a friendly, low-pressure way.',
    maxTokens: 400,
  },
};

// Safety net for Phil's rule #1: drafted content must never contain a long dash
// (em/en dash) or a "--"/"---" run, which read as AI-generated. Clause-break dashes
// become commas; numeric ranges collapse to a plain hyphen. Single in-word hyphens
// (e.g. "highest-ROI", "30-min") are left untouched.
export function stripLongDashes(text: string): string {
  return text
    .replace(/(\d)\s*[—–―]\s*(\d)/g, '$1-$2') // numeric ranges: 30–60 -> 30-60
    .replace(/\s*[—–―]\s*/g, ', ') // em/en/horizontal-bar dash -> comma
    .replace(/\s*-{2,}\s*/g, ', ') // runs of 2+ hyphens -> comma
    .replace(/\s+,/g, ',') // no space before a comma
    .replace(/,{2,}/g, ',') // collapse doubled commas
    .replace(/,(\s*[.!?])/g, '$1') // comma immediately before end punctuation
    .replace(/(^|\n)\s*,\s*/g, '$1') // no leading comma on a line
    .replace(/[ \t]{2,}/g, ' ') // collapse runs of spaces
    .trim();
}

// Build a single-channel cold-outreach draft for a lead, in Phil's voice, grounded
// in the active lane's tone and the operator's pitch. Returns the ready-to-send
// message, or null if generation fails (or the channel isn't draftable, e.g. phone).
export async function generateDraft(
  db: Database.Database,
  lead: OutreachLead,
  channel: OutreachChannel
): Promise<string | null> {
  if (channel === 'phone') return null;
  const shape = CHANNEL_INSTRUCTIONS[channel];

  const pitch = getOutreachPitch(db);
  const lane = isLaneId(lead.lane) ? LANES[lead.lane] : null;
  const laneVoice = lane
    ? `Active outreach lane: ${lane.name} (${lane.archetype}). ${lane.blurb} Let this shade the tone, not the offer.`
    : '';

  const research = usableResearch(lead.research_notes);

  const systemPrompt = [
    'You are drafting cold outreach AS Phil Smith of RekindleLeads, an AI agency operator in Middle Tennessee.',
    'Voice: anti-hype, operator-first, honest. Phil ran businesses for 38 years before building AI systems, so he sounds like an operator who has made payroll, not a marketer.',
    'Use the pitch below as the source of truth for the offer, the tagline, and the proof numbers. Match the proof number to the recipient\'s industry (RIA/financial: cut a major time-sink ~80%; chiropractic: tripled bookings; nonprofit: 4x grants) when it fits; otherwise use the recent-client examples.',
    laneVoice,
    '',
    'PITCH (source of truth):',
    pitch,
    '',
    'OUTPUT RULES:',
    '- CRITICAL: never use a long dash. No em dash (—), no en dash (–), and no "--" or "---". They make writing look AI-generated. Use commas, periods, or parentheses instead. Number ranges use a plain hyphen, e.g. "30-60 minutes". This rule is absolute.',
    '- Output ONLY the ready-to-send message. No preamble, no commentary, no notes, no markdown headers, no surrounding quotes.',
    '- Do NOT leave any placeholder brackets unfilled. Use the lead\'s real first name from contact_person ONLY if one is given. If no contact first name is provided, you MUST open with the neutral greeting "Hi there," and you must NOT invent, guess, or infer a personal first name (never "Chris," "Scott," etc.) and must NOT use the business or company name as the salutation (never "Acme Co," or "McCarroll,"). No "[First Name]" placeholder either.',
    '- Personalize concretely: weave in at least one specific, TRUE detail about this lead from the data given (their industry/category, their company size, or their city/state) so the message reads as written for them, not a mass blast. Keep it natural, one light touch, not a list.',
    '- Never invent specifics you were not given. Do NOT guess what they make or sell beyond the stated category, do not invent revenue, headcount precision, named people, or any claim about their website. If you only have a website URL, you may note you came across it, but make no claims about its contents.',
    research
      ? '- A RESEARCHED FACTS section lists verified facts about this lead found via web search. Weave in ONE, at most two, of these facts naturally, so the message reads like you did your homework, never like you were watching them. Do not list facts. NEVER include or quote the source URLs in the message.'
      : '',
    shape.instruction,
  ]
    .filter(Boolean)
    .join('\n');

  const details: string[] = [];
  if (lead.business_name) details.push(`Business: ${lead.business_name}`);
  if (lead.contact_person) {
    details.push(`Contact person (use first name): ${lead.contact_person}`);
  } else {
    details.push('Contact first name: NONE ON FILE. Open with "Hi there," and do not invent or guess a name.');
  }
  if (lead.segment) details.push(`Segment: ${lead.segment}`);
  if (lead.category) details.push(`Category / industry: ${lead.category}`);
  const place = [lead.city, lead.state].filter(Boolean).join(', ');
  if (place) details.push(`Location: ${place}`);
  // Company size, phrased as an approximate headcount the model can reference naturally.
  if (lead.employee_min && lead.employee_max) {
    details.push(`Company size: roughly ${lead.employee_min}-${lead.employee_max} employees`);
  } else if (lead.employee_min) {
    details.push(`Company size: ${lead.employee_min}+ employees`);
  }
  if (lead.website) details.push(`Website (reference only, do not invent claims about it): ${lead.website}`);
  if (research) {
    details.push('', 'RESEARCHED FACTS (verified via web search, with sources; you may reference these):', research);
  }

  const userMessage = [
    `Draft the ${channel} outreach message for this lead:`,
    ...details,
    '',
    'Return only the message itself.',
  ].join('\n');

  const result = await askClaude(systemPrompt, userMessage, shape.maxTokens, 'claude-sonnet-4-6');
  return result ? stripLongDashes(result.trim()) : null;
}
