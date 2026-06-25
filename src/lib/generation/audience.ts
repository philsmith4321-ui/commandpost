import type { Avatar, MasterProfile } from '@/lib/types';

function bullets(items: string[]): string {
  return items.map((i) => `- ${i}`).join('\n');
}

function masterBlock(m: MasterProfile): string {
  const parts: string[] = ['## Master audience profile (applies to every piece)'];
  if (m.identity) parts.push(`Who they are: ${m.identity}`);
  if (m.wants) parts.push(`What they want: ${m.wants}`);
  if (m.burned_by) parts.push(`How they've been burned: ${m.burned_by}`);
  if (m.buying_trigger) parts.push(`Buying trigger: ${m.buying_trigger}`);
  if (m.trust_builders.length) parts.push(`What earns their trust:\n${bullets(m.trust_builders)}`);
  if (m.objections.length) {
    const lines = m.objections.map((o) => `- "${o.objection}" → ${o.counter}`).join('\n');
    parts.push(`Universal objections (respect these; counter when relevant):\n${lines}`);
  }
  if (m.tone) parts.push(`Tone for all content: ${m.tone}`);
  return parts.join('\n');
}

function verticalBlock(v: Avatar): string {
  const parts: string[] = [`## Vertical overlay — ${v.name}`];
  if (v.persona) parts.push(`Persona: ${v.persona}`);
  if (v.summary) parts.push(v.summary);
  if (v.description) parts.push(v.description);
  if (v.pains.length) parts.push(`Their pain (in their words):\n${bullets(v.pains)}`);
  if (v.desires.length) parts.push(`Desired outcome:\n${bullets(v.desires)}`);
  if (v.objections.length) parts.push(`Vertical-specific objections:\n${bullets(v.objections)}`);
  if (v.vocabulary.length) parts.push(`Vocabulary to use: ${v.vocabulary.join(', ')}`);
  if (v.trust_triggers.length) parts.push(`Trust triggers:\n${bullets(v.trust_triggers)}`);
  if (v.buying_trigger) parts.push(`Buying trigger: ${v.buying_trigger}`);
  if (v.channels.length) parts.push(`Channels: ${v.channels.join(', ')}`);
  return parts.join('\n');
}

function contentRules(master: MasterProfile | null, vertical: Avatar | null): string {
  const rules: string[] = ['## Content rules (apply to this piece)'];
  const hasMasterObj = !!master && master.objections.length > 0;
  const hasVertObj = !!vertical && vertical.objections.length > 0;
  if (hasMasterObj && hasVertObj) {
    rules.push('- Resolve at least one universal (master) objection using its counter, AND at least one vertical-specific objection.');
  } else if (hasMasterObj) {
    rules.push('- Resolve at least one universal (master) objection using its counter.');
  } else if (hasVertObj) {
    rules.push('- Resolve at least one vertical-specific objection.');
  }
  if (vertical?.proof_point) {
    rules.push(`- Weave in this proof point for credibility: ${vertical.proof_point}.`);
  }
  return rules.length > 1 ? rules.join('\n') : '';
}

/**
 * Build the audience system-context block.
 * - master + vertical: full overlay with anchored writing target + content rules.
 * - master only (vertical null, no allVerticals): just the master layer.
 * - all-verticals (opts.allVerticals): generic, off-spec; names listed, no vocab merge.
 */
export function composeAudience(
  master: MasterProfile | null,
  vertical: Avatar | null,
  opts?: { allVerticals?: Avatar[] }
): string {
  const blocks: string[] = [];
  if (master) blocks.push(masterBlock(master));

  if (vertical) {
    blocks.push(verticalBlock(vertical));
    if (vertical.writing_target) {
      blocks.push(`## Writing target (anchor every sentence to this)\n${vertical.writing_target}`);
    }
  } else if (opts?.allVerticals && opts.allVerticals.length) {
    const names = opts.allVerticals.map((a) => a.name).join(', ');
    blocks.push(
      `## All verticals (GENERIC mode — off-spec)\n` +
      `This piece targets a general audience across these verticals: ${names}. ` +
      `Do NOT blend their specific vocabularies; keep it broadly applicable and lean on the master profile.`
    );
  }

  const rules = contentRules(master, vertical);
  if (rules) blocks.push(rules);

  return blocks.join('\n\n');
}
