// The Four Lanes — Operating Plans (RekindleLeads · AI Agency Operator Training)
// Structured so both the Playbook tab and the My Week tracker read from one source.

export type LaneId = 'connector' | 'hunter' | 'broadcaster' | 'magnet';

// Manual counters a lane's leading metric needs that the lead pipeline can't see.
export interface MetricInput {
  key: string; // stored in outreach_week.metrics JSON
  label: string;
}

export interface LeadingMetric {
  label: string; // the one number
  definition: string; // what it measures / why it predicts cash
  // Manual inputs the operator taps each week.
  inputs: MetricInput[];
  // How the metric value is computed from manual inputs + derived lead stats.
  // 'rate'  -> 100 * inputs[1] / inputs[0]  (e.g. replies / sends)
  // 'count' -> sum of the single input (e.g. referral asks)
  // 'ratio' -> input vs a derived denominator (referral asks vs Discovery Done)
  kind: 'rate' | 'count' | 'ratio';
  unit: '%' | 'count';
  target: string; // human-readable healthy band
  targetMin?: number; // for status bar
  targetMax?: number;
  danger?: number; // crossing this (below, for rates) arms the dry well
  dangerLabel: string;
  // For 'ratio': the derived stat key the input is compared against.
  ratioAgainst?: 'discoveryDone';
}

export interface Lane {
  id: LaneId;
  name: string;
  archetype: string; // one-line vibe
  blurb: string;
  pairing: string; // routing rule note
  leadingMetric: LeadingMetric;
  weeklyCadence: string[];
  dryWellIntro: string;
  dryWell: string[];
  ghlLayer: string[];
  accent: string; // tailwind color stem, e.g. 'emerald'
}

export const FRAMEWORK_INTRO = {
  title: 'The Four Lanes — Operating Plans',
  tagline:
    'The framework tells you which road you are on. This tells you how to drive it — the one number that predicts your next client, the weekly rhythm that keeps the well full, what to do the day it runs dry, and the GHL build underneath.',
  routingRule:
    'You do not pick lanes off a menu. Your placement assigns your primary lane, and the primary lane tells you whether you need a second one now or later. Hunter and Connector eat fast enough to run solo for 30 days, then layer a complementary lane after the first close. Broadcaster and Magnet ship paired from day one with a direct lane that pays the bills while the slow asset compounds.',
};

export const ROUTING_TABLE: { lane: string; solo: string; companion: string; when: string }[] = [
  { lane: 'Hunter', solo: 'Yes', companion: 'Optional second lane', when: 'After first client' },
  { lane: 'Connector', solo: 'Yes', companion: 'Optional second lane', when: 'After first client' },
  { lane: 'Broadcaster', solo: 'No', companion: 'Connector or Hunter (required)', when: 'Day one' },
  { lane: 'Magnet', solo: 'No', companion: 'Connector or Broadcaster (required)', when: 'Day one' },
];

export const SHARED_PIPELINE: { stage: string; note: string }[] = [
  { stage: 'Sourced', note: 'lead identified / added, not yet contacted' },
  { stage: 'Outreach Sent', note: 'first touch made' },
  { stage: 'Engaged', note: 'they replied / responded to a CTA / completed a tool' },
  { stage: 'Call Booked', note: 'discovery call on the calendar' },
  { stage: 'Discovery Done', note: 'listen-first call completed, pain documented' },
  { stage: 'Proposal Sent', note: '3-tier (L1/L2/L3) delivered' },
  { stage: 'Won', note: 'signed' },
  { stage: 'Lost / Nurture', note: 'parked, with a reason tag and a re-touch date' },
];

export const SHARED_CORE = {
  pipelineNote:
    'Every lane flows through the same pipeline. The lane only changes how a contact enters at stage 1–2 and what automation fires as they move. From the discovery call onward, every lane is identical — because from there you are running the same business.',
  universalTags: [
    'lane:<id> — which door produced this contact',
    'pain:[label] — the expensive pain, in their words',
    'referral:y/n — did this come from a referral ask',
    'lost_reason:[label] + retouch_date — nothing dies silently',
  ],
  referralAsk:
    'The referral ask is a stage-5 rule on the shared pipeline, not a Connector tactic. When any contact hits Discovery Done, fire a task: "Who else do you know wrestling with this?" A referral re-enters at Sourced, tagged referral:y, inheriting the sender’s warmth.',
  trackingDiscipline:
    'One weekly number per operator — the leading metric for your lane — reviewed every Monday. Coaching is the metric, not the mood. "I sent 12 pain-led outreaches and got 3 replies" is a number; "I worked hard" is not.',
};

export const LANES: Record<LaneId, Lane> = {
  connector: {
    id: 'connector',
    name: 'Connector',
    archetype: 'Relational · warm · “I hate selling”',
    blurb: 'Your pipeline never dries up while you keep asking who else they know.',
    pairing: 'Runs solo for 30 days. Layer a second lane after the first close.',
    accent: 'emerald',
    leadingMetric: {
      label: 'Referral asks made / week',
      definition:
        'Not coffees booked — those run out. The number that predicts a pipeline that never dries is how many times you actually asked "who else do you know?" Should track 1:1 with Discovery Done.',
      inputs: [{ key: 'referral_asks', label: 'Referral asks made this week' }],
      kind: 'ratio',
      unit: 'count',
      target: 'A referral ask on 100% of completed conversations',
      ratioAgainst: 'discoveryDone',
      dangerLabel: 'Asks falling behind your conversations — pipeline starts dying (you feel it in ~3 weeks)',
    },
    weeklyCadence: [
      '3–5 warm conversations booked or held',
      'A referral ask on 100% of them, logged',
      'Work last week’s referrals into this week’s bookings',
      'One new room every 2–4 weeks (chamber, church group, meetup) — calendared, not “when I get to it”',
    ],
    dryWellIntro:
      'The well runs dry around day 14 when the warm list is exhausted. The instinct is to retreat into building. Don’t — it’s almost always a skipped referral ask, not running out of people.',
    dryWell: [
      'Mine the second ring — people your contacts know that you’ve met once. 20 names.',
      'Re-ask your best conversations: "Been thinking about what you said about [pain] — anyone else come to mind?"',
      'Book the room. A dry well means cadence rule one slipped. One new room this week, non-negotiable.',
    ],
    ghlLayer: [
      'Entry: manually add the warm list (40+), tagged lane:connector; smart list filters to un-contacted.',
      'At Outreach Sent: the coffee-ask template as a 1:1 (not a blast), booking link included.',
      'At Call Booked: confirmation + reminder SMS (opted-in warm contacts — clean, no A2P problem).',
      'At Discovery Done: auto-task "Make the referral ask." The single most important automation in the lane.',
      'Referral capture: referred name drops in at Sourced, tagged referral:y, task to reach out within 48h.',
      'Renewable engine: recurring monthly "Book next room" task that won’t close without naming the event.',
    ],
  },
  hunter: {
    id: 'hunter',
    name: 'Hunter',
    archetype: 'Direct · competitive · fine hearing “no”',
    blurb: 'Volume is the input; reply rate is the signal. Sharpen the observation, not the send count.',
    pairing: 'Runs solo for 30 days. Layer a second lane after the first close.',
    accent: 'orange',
    leadingMetric: {
      label: 'Reply rate on pain-led outreach',
      definition:
        'A Hunter at 2% has a targeting or opener problem, not a volume problem — sending more just damages reputation faster. Healthy local pain-led outreach clears 8–12%. Below 5%, stop sending and fix the list or the observation.',
      inputs: [
        { key: 'sends', label: 'Pain-led outreaches sent' },
        { key: 'replies', label: 'Replies received' },
      ],
      kind: 'rate',
      unit: '%',
      target: '8–12% replies',
      targetMin: 8,
      targetMax: 12,
      danger: 5,
      dangerLabel: 'Below 5% — stop sending, fix the list or the observation',
    },
    weeklyCadence: [
      '10–15 personalized, pain-led outreaches (a specific observation in the first line)',
      'Reply rate logged and reviewed every Monday',
      'Opener revised weekly based on what’s getting replies',
      'List topped up: +10 new targeted SMBs so you never send to a stale list',
    ],
    dryWellIntro:
      'The Hunter never runs out of targets — they run out of patience and start spraying generic messages when replies dip. Spray is the failure, every time.',
    dryWell: [
      'Stop sending. Audit the last 20 — were they actually pain-targeted, or did you blast anyone with a website?',
      'Re-tighten criteria. Pull 20 fresh targets where you can name the specific, expensive pain before writing.',
      'Rewrite one opener variable (the pain or the number). Test on 10. Don’t change five things at once.',
    ],
    ghlLayer: [
      'Entry: bulk import targeted list, tagged lane:hunter, with pain: populated at import.',
      'Channel: cold email + manual dialer tasks — NOT automated SMS (A2P 10DLC violation). SMS only after they opt in.',
      'At Outreach Sent: pain-led opener with {{pain}} merged, plus day-3 and day-7 follow-up tasks.',
      'On reply: auto-move to Engaged, tag, fire a task to book the call.',
      'Weekly: saved dashboard of sends / replies / reply rate so Monday review is one click.',
    ],
  },
  broadcaster: {
    id: 'broadcaster',
    name: 'Broadcaster',
    archetype: 'Visible · expressive · enjoys being seen',
    blurb: 'Ships paired from day one. Your content does not pay you in month one — the paired lane does.',
    pairing: 'Required pairing from day one: Connector or Hunter.',
    accent: 'violet',
    leadingMetric: {
      label: 'Publishing consistency × CTA responses',
      definition:
        'Month 1: track your paired lane’s number — content does not pay yet. Month 2+: consistency is the leading half (did you publish 3x/week, every post with a CTA — a yes/no you control); CTA responses are the lagging confirmation. If consistency holds 6–8 weeks and CTA responses are still zero, fix the offer or topic, not the cadence.',
      inputs: [
        { key: 'posts', label: 'Posts published (target 3)' },
        { key: 'cta_responses', label: 'CTA responses' },
      ],
      kind: 'count',
      unit: 'count',
      target: '3 posts/week, every post a CTA',
      targetMin: 3,
      dangerLabel: 'Published fewer than 3 with a CTA — consistency slipped',
    },
    weeklyCadence: [
      'Publish 3x/week minimum on one primary channel — every piece ends in a CTA',
      'One in-person talk or lunch-and-learn booked or delivered per month',
      'The paired direct lane’s full cadence, run underneath, for cash',
    ],
    dryWellIntro:
      'The "dry well" is the week-three wall — content is slow, nobody responds, quitting feels rational. It isn’t a dry well, it’s the normal compounding curve.',
    dryWell: [
      'Check the CTA, not the audience. "Comment AUDIT" is a CTA; "let me know your thoughts" is not.',
      'Mine your own content: whoever engaged goes onto your Hunter/Connector list. DM the engagers.',
      'Lean on the paired lane. Keep publishing; go close someone through the other door.',
    ],
    ghlLayer: [
      'Entry: inbound via keyword — "comment/text AUDIT" → keyword trigger → clean opt-in → deliver the 2-min breakdown → booking link. Tagged lane:broadcaster.',
      'After a talk: a booking page with 3 discovery slots; "grab one on your way out" + QR on the closing slide.',
      'Nurture: keyword responders who don’t book in 48h get one follow-up, then drop to Nurture with a retouch date.',
      'Content lives outside GHL — GHL’s job is capture + booking. Don’t over-build; the leverage is keyword-to-calendar.',
    ],
  },
  magnet: {
    id: 'magnet',
    name: 'Magnet',
    archetype: 'Builder · introverted · would rather make than talk',
    blurb: 'Most likely to stall — building feels like progress while nobody sees the work. Distribution first.',
    pairing: 'Required pairing from day one: Connector or Broadcaster for traffic.',
    accent: 'sky',
    leadingMetric: {
      label: 'Distribution seeded → qualified completions',
      definition:
        'Month 1: track distribution (qualified entries you drove + posts/partners placed) AND your paired lane’s number — the tool converts nothing if nobody runs it. Month 2+: qualified completions → calls becomes the real signal. A low rate means the audit isn’t surfacing pain the vertical feels — fix the questions, not the traffic.',
      inputs: [
        { key: 'distribution', label: 'Distribution actions (warm-sends / posts / partners)' },
        { key: 'completions', label: 'Qualified tool completions' },
      ],
      kind: 'count',
      unit: 'count',
      target: 'Active distribution every week',
      targetMin: 1,
      dangerLabel: 'No distribution this week — building is hiding',
    },
    weeklyCadence: [
      'Tool stays live and unbroken (a dead tool is worse than no tool)',
      'Active distribution every week: warm-send to the vertical, post in one niche community, or line up one partner',
      'The paired lane’s cadence run underneath for cash and human reps',
      'Hard rule: no second tool feature until v1 has driven real traffic',
    ],
    dryWellIntro:
      'The Magnet’s dry well is self-inflicted: the tool’s live, nobody uses it, and the response is to improve the tool. That’s the cave.',
    dryWell: [
      'Do not touch the tool. Low entries = a distribution problem, not a features problem.',
      'Hand-seed 20: personally send the audit to 20 warm contacts in your one vertical, with a one-line note.',
      'Secure one distributor — a person or community that already has the vertical’s attention.',
    ],
    ghlLayer: [
      'Entry: audit/assessment as a GHL form (or external tool webhooking results in). Completion → scored → qualified auto-books; others get results + nurture. Tagged lane:magnet.',
      'One vertical only — the form copy speaks the vertical’s language and names its pains.',
      'Qualification logic: score answers, route high-intent straight to a booking link, rest to results email + retouch.',
      'Distribution tracking: a source: field (warm-send / community / partner) so you can see which channel drives qualified calls.',
    ],
  },
};

export const LANE_ORDER: LaneId[] = ['connector', 'hunter', 'broadcaster', 'magnet'];

export function isLaneId(v: unknown): v is LaneId {
  return typeof v === 'string' && (LANE_ORDER as string[]).includes(v);
}
