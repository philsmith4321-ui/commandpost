import type Database from 'better-sqlite3';
import type { OutreachChannel } from '@/lib/types';
import type { OutreachLead } from '@/lib/queries/outreach-lead-queries';
import { askClaude } from '@/lib/claude';
import { LANES, isLaneId } from '@/lib/outreach/lanes';
import { getOutreachPitch } from './pitch';

// Per-channel shaping: the instruction handed to the model + a token budget.
const CHANNEL_INSTRUCTIONS: Record<Exclude<OutreachChannel, 'phone'>, { instruction: string; maxTokens: number }> = {
  letter: {
    instruction:
      'Channel: HANDWRITTEN LETTER. Write a warm, human one-short-page note that reads like it was written by hand. Never mention automation, "AI tools," or anything that breaks the handwritten illusion. Operator voice, plain and direct. Sign off exactly with: "Phil Smith, RekindleLeads · 615-969-7941 · rekindleleads.com".',
    maxTokens: 1024,
  },
  email: {
    instruction:
      'Channel: COLD EMAIL. Output a "Subject: ..." line first, then a blank line, then the body. The subject line carries most of the weight — make it honest and intriguing (e.g. "the honest version of an AI pitch"). Keep the body short. End with the CAN-SPAM opt-out line: "Reply \'no thanks\' and I won\'t follow up." Include the contact line: Phil Smith, RekindleLeads · rekindleleads.com · 615-969-7941.',
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

  const systemPrompt = [
    'You are drafting cold outreach AS Phil Smith of RekindleLeads — an AI agency operator in Middle Tennessee.',
    'Voice: anti-hype, operator-first, honest. Phil ran businesses for 38 years before building AI systems, so he sounds like an operator who has made payroll, not a marketer.',
    'Use the pitch below as the source of truth for the offer, the tagline, and the proof numbers. Match the proof number to the recipient\'s industry (RIA/financial → cut a major time-sink ~80%; chiropractic → tripled bookings; nonprofit → 4x grants) when it fits; otherwise use the recent-client examples.',
    laneVoice,
    '',
    'PITCH (source of truth):',
    pitch,
    '',
    'OUTPUT RULES:',
    '- Output ONLY the ready-to-send message. No preamble, no commentary, no notes, no markdown headers, no surrounding quotes.',
    '- Do NOT leave any placeholder brackets unfilled. Use the lead\'s real first name from contact_person; if no name is known, open with a natural greeting (no "[First Name]").',
    '- Personalize lightly to the lead\'s business, industry, and city when you can — but never invent specific facts you weren\'t given.',
    shape.instruction,
  ]
    .filter(Boolean)
    .join('\n');

  const details: string[] = [];
  if (lead.business_name) details.push(`Business: ${lead.business_name}`);
  if (lead.contact_person) details.push(`Contact person (use first name): ${lead.contact_person}`);
  if (lead.segment) details.push(`Segment: ${lead.segment}`);
  if (lead.category) details.push(`Category / industry: ${lead.category}`);
  if (lead.city) details.push(`City: ${lead.city}`);

  const userMessage = [
    `Draft the ${channel} outreach message for this lead:`,
    ...details,
    '',
    'Return only the message itself.',
  ].join('\n');

  const result = await askClaude(systemPrompt, userMessage, shape.maxTokens, 'claude-sonnet-4-6');
  return result ? result.trim() : null;
}
