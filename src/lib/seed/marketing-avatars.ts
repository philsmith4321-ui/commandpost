import type Database from 'better-sqlite3';
import type { AvatarInput } from '@/lib/queries/avatar-queries';
import type { MasterProfileInput } from '@/lib/types';
import { createAvatar } from '@/lib/queries/avatar-queries';
import { upsertMasterProfile, getMasterProfile } from '@/lib/queries/master-queries';

const MASTER: MasterProfileInput = {
  identity:
    'Owner-operator, 38–60, running a $500K–$5M business they built with their own hands. Practitioner first, businessperson second — they got into this to do the work they are good at, not to run marketing. Every hour on admin is stolen from the thing they actually do. Carries a quiet worry they are falling behind on "this AI stuff."',
  wants:
    'The result, not the toolkit. Missed revenue recovered, follow-up that happens without them, and their time back. Time is the real currency — more than money in most cases. They do not want to become a tech person or manage another dashboard.',
  burned_by:
    'Marketing agencies that overpromised and disappeared. SaaS that required a full-time person to operate. "Gurus" selling courses. Anything that smells like hype — they have a finely tuned BS detector.',
  buying_trigger:
    'A specific pain that just cost them money or sleep — a missed lead, a launch they cannot staff, a follow-up that never happened, a busy season they cannot keep up with. They do not buy "AI"; they buy relief from a moment that hurt.',
  tone:
    'Direct, plainspoken, builder-to-owner. No "great question," no hedging, no buzzwords. Confident but not slick. Talk with them, not at them.',
  objections: [
    { objection: 'AI will sound robotic / won\'t sound like me.', counter: 'Show voice fidelity — their words, not the machine\'s.' },
    { objection: 'I\'ve been burned before.', counter: 'Prove it with a real, working build, not promises.' },
    { objection: 'Is this just another thing I have to manage?', counter: 'Frame it done-for-you, runs-without-you.' },
    { objection: 'My business is different / too small for this.', counter: 'Use vertical-specific specifics that prove you get their world.' },
    { objection: 'What\'s the actual ROI?', counter: 'Show concrete recovered-revenue or recovered-time math.' },
  ],
  trust_builders: [
    'Seeing a real, working thing — not slides, not a deck.',
    'Plain English. Zero jargon-dumping.',
    'Someone who asks about their business before talking about themselves.',
    'Relational and local credibility — they buy from people, not vendors.',
    'For faith-based and Middle TN: shared values, relationships over transactions.',
  ],
};

const OVERLAYS: AvatarInput[] = [
  {
    name: 'Fee-Only RIA / Financial Advisor',
    persona: 'David, the Fiduciary. Owns or leads a fee-only RIA; takes pride in being a fiduciary and quietly resents the commission-sales reputation of the broader industry.',
    summary: 'Fee-only registered investment advisor; fiduciary identity.',
    pains: [
      'Content marketing is a slog and I never have time to write.',
      'Compliance review eats hours I don\'t have.',
      'I can\'t scale my voice — everything good comes out of my head.',
      'The big firms outspend me on radio and Google and I can\'t keep up.',
      'Leads are slow and I have no real engine for them.',
    ],
    desires: ['A content and marketing engine that grows AUM without him writing every word and without creating a compliance liability.'],
    objections: ['Compliance (SEC/FINRA): anything AI-generated must be reviewable, archivable, on-brand, and free of promissory language. Lead with respect for this or lose him instantly.'],
    what_tried: 'Hired a generic marketing agency that didn\'t understand compliance and produced unusable copy. Tried writing himself and burned out.',
    vocabulary: ['fiduciary', 'fee-only', 'AUM', 'prospects', 'drip', 'ADV', 'compliance archive', 'suitability', 'fee-only vs. commission', 'ideal client'],
    trust_triggers: ['You understand fee-only vs. commission.', 'You respect compliance as a feature, not a hurdle.', 'You\'ve built for an RIA before (PWI).'],
    buying_trigger: 'He\'s realized his marketing engine is the actual bottleneck to AUM growth, and the manual content/compliance loop can\'t scale.',
    channels: ['LinkedIn', 'email', 'industry podcasts', 'RIA-specific communities', 'referrals'],
    proof_point: 'Paul Winkler Inc (PWI) — a real fee-only RIA marketing engine you built.',
    writing_target: 'Write to a fee-only fiduciary who values doing right by clients, is allergic to hype, and needs everything to clear compliance — show him a marketing engine that scales his voice without scaling his risk.',
  },
  {
    name: 'Chiropractor / Clinic Owner',
    persona: 'Dr. Banning-type. Owns a practice, often single-location. Strong clinically, but marketing is reactive and improvised. Thinks of himself as a doctor, not a marketer.',
    summary: 'Single-location chiropractic / clinic owner.',
    pains: [
      'No-shows are killing my schedule.',
      'Follow-up falls through the cracks the second the front desk gets busy.',
      'I\'m launching a new cash-pay service and have no marketing behind it.',
      'Reactivation? I know I should be doing it. I\'m not.',
      'I\'ve paid for ad packages that never converted.',
    ],
    desires: ['A full patient-acquisition and reactivation system that runs without his front desk having to remember anything — especially behind a new cash-pay launch.'],
    objections: [
      'I\'m a doctor, not a marketer.',
      'Health-claim and device compliance (FDA/FTC for laser/Zerona).',
      'Skepticism from past ad spend that didn\'t convert.',
    ],
    what_tried: 'Expensive ad agencies and "done-for-you" packages that produced clicks but not booked patients.',
    vocabulary: ['new patient acquisition', 'reactivation', 'recall', 'ROF (report of findings)', 'PVA (patient visit average)', 'no-shows', 'cash-pay', 'reviews', 'front desk'],
    trust_triggers: ['You understand clinic flow and front-desk reality.', 'You respect health-claim/device compliance.', 'You can point to a real launch you ran (Zerona/White House).'],
    buying_trigger: 'Launching a new cash-pay service with no infrastructure, or watching reactivation and follow-up slip while the schedule has holes.',
    channels: ['Facebook/Instagram', 'local SEO', 'practice-owner groups', 'chiropractic conferences', 'referrals'],
    proof_point: 'The Zerona launch at White House Chiropractic — a real cash-pay service launch you ran.',
    writing_target: 'Write to a clinic owner who\'s a great doctor and a reluctant marketer — show him a system that fills the schedule and follows up automatically so his front desk doesn\'t have to, and that won\'t get him in trouble with the FDA/FTC.',
  },
  {
    name: 'Faith-Based Nonprofit Leader',
    persona: 'The Director. Executive director or founder of a mission-driven nonprofit. Chronically under-resourced, wears every hat, runs on conviction and caffeine.',
    summary: 'Mission-driven, faith-based nonprofit leader; lowest budget — price-frame carefully.',
    pains: [
      'Grant writing eats weeks I don\'t have and I\'m not even sure I\'m doing it right.',
      'Donor communication is inconsistent — I mean to follow up and I don\'t.',
      'Marketing? With what staff?',
      'We\'re leaving funding on the table because I can\'t keep up.',
    ],
    desires: ['Capacity: grant submissions that actually go out, consistent donor communication, and marketing that happens without a hire she can\'t afford.'],
    objections: [
      'Budget is dominant — frame everything around stewardship and ROI, never cost.',
      'Is this aligned with our mission and our values?',
      'Tech overwhelm.',
    ],
    what_tried: 'Doing it all herself, volunteers who come and go, free tools she never has time to learn.',
    vocabulary: ['donors', 'grants', 'mission', 'stewardship', 'impact', 'board', 'capacity', 'development'],
    trust_triggers: ['Shared faith and values — and meaning it, not using it as an angle.', 'Understanding nonprofit constraints.', 'Clear evidence you\'re not just extracting money from a tight budget.'],
    buying_trigger: 'A grant deadline, a hard capacity wall, or a board pushing to "modernize."',
    channels: ['Faith communities', 'nonprofit networks', 'referrals', 'local relationships', 'LinkedIn'],
    proof_point: 'GrantCraft / The Way Maker Place — real grant + capacity work for a faith-based nonprofit.',
    writing_target: 'Write to a mission-driven, under-resourced nonprofit leader who shares your faith and values — show her how to multiply her capacity (grants, donor follow-up, marketing) as good stewardship, framed around impact and never around cost.',
  },
  {
    name: 'Home Services Owner',
    persona: 'The Owner-Operator. HVAC, plumbing, electrical, roofing, landscaping. Field-based, often still in the truck. Built the business on sweat and reputation.',
    summary: 'Field-based home-services owner-operator; wants dead-simple.',
    pains: [
      'Every missed call is money walking out the door.',
      'We\'re too slow getting back to leads.',
      'Quotes go out and we never follow up.',
      'Reviews matter and I have no system for getting them.',
      'Busy season we\'re drowning, slow season we\'re scrambling.',
    ],
    desires: ['Speed to lead, automatic follow-up on every quote, more reviews, and a way to smooth seasonal swings — all dead simple, no babysitting.'],
    objections: [
      'I\'m not a computer guy.',
      'Suspicious of marketing spend after past disappointments.',
      'Wants it simple — if it\'s complicated, it\'s dead on arrival.',
    ],
    what_tried: 'A lead-gen company that sold him garbage leads, or an answering service that didn\'t book jobs.',
    vocabulary: ['jobs', 'tickets', 'dispatch', 'leads', 'quotes/estimates', 'speed to lead', 'reviews', 'busy season', 'calls'],
    trust_triggers: ['You talk like a real person, not a salesperson.', 'You get that every missed call is real money.', 'You deliver something tangible fast.'],
    buying_trigger: 'A busy season he can\'t keep up with, or a slow stretch he needs to fill — both mean "I\'m losing money right now."',
    channels: ['Facebook', 'local search/Google', 'trade groups', 'referrals', 'word of mouth'],
    proof_point: 'SkyTrain-adjacent field/lead-gen work — speed-to-lead and follow-up for field service businesses.',
    writing_target: 'Write to a no-nonsense home services owner who\'s still close to the field — show him how to stop losing money on missed calls and dead quotes with something dead simple that books jobs and runs itself.',
  },
];

/** Idempotent: seeds master (only if unset) and each overlay (only if its name is absent). */
export function seedMarketingAvatars(db: Database.Database): void {
  if (!getMasterProfile(db)) {
    upsertMasterProfile(db, MASTER);
  }
  const existing = new Set(
    (db.prepare('SELECT name FROM avatars').all() as { name: string }[]).map((r) => r.name)
  );
  for (const overlay of OVERLAYS) {
    if (!existing.has(overlay.name)) createAvatar(db, overlay);
  }
}
