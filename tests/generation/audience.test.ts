import { describe, it, expect } from 'vitest';
import { composeAudience } from '@/lib/generation/audience';
import type { Avatar, MasterProfile } from '@/lib/types';

const MASTER: MasterProfile = {
  id: 1, identity: 'Owner-operator', wants: 'time back', burned_by: 'agencies',
  buying_trigger: 'a missed lead', tone: 'Direct, plainspoken',
  objections: [{ objection: 'Sounds robotic', counter: 'Show voice fidelity' }],
  trust_builders: ['Real working thing'], updated_at: '',
};

const RIA: Avatar = {
  id: 2, name: 'Fee-Only RIA', summary: null, description: null, tone: null, is_active: 1,
  created_at: '', updated_at: '', persona: 'David, the Fiduciary', buying_trigger: 'marketing is the bottleneck',
  proof_point: 'PWI', writing_target: 'Write to a fee-only fiduciary…', what_tried: 'generic agency',
  pains: ['Content is a slog'], desires: ['Engine that scales his voice'], objections: ['Compliance / SEC'],
  vocabulary: ['fiduciary', 'AUM'], trust_triggers: ['You get fee-only'], channels: ['LinkedIn'],
};

const CHIRO: Avatar = { ...RIA, id: 3, name: 'Chiropractor', vocabulary: ['PVA', 'no-shows'] };

describe('composeAudience', () => {
  it('master-only includes master block, no vertical block', () => {
    const out = composeAudience(MASTER, null);
    expect(out).toContain('Master audience profile');
    expect(out).toContain('Owner-operator');
    expect(out).not.toContain('Vertical overlay');
  });

  it('master + vertical anchors the writing target and applies both content rules', () => {
    const out = composeAudience(MASTER, RIA);
    expect(out).toContain('Master audience profile');
    expect(out).toContain('Vertical overlay — Fee-Only RIA');
    expect(out).toContain('Writing target');
    expect(out).toContain('Write to a fee-only fiduciary');
    expect(out).toContain('one universal (master) objection');
    expect(out).toContain('one vertical-specific objection');
    expect(out).toContain('PWI'); // proof injection
  });

  it('does not merge two verticals — only the selected vocabulary appears', () => {
    const out = composeAudience(MASTER, RIA);
    expect(out).toContain('fiduciary');
    expect(out).not.toContain('PVA');
  });

  it('all-verticals mode lists names but does not merge vocabularies', () => {
    const out = composeAudience(MASTER, null, { allVerticals: [RIA, CHIRO] });
    expect(out).toContain('GENERIC mode');
    expect(out).toContain('Fee-Only RIA, Chiropractor');
    expect(out).not.toContain('fiduciary');
    expect(out).not.toContain('PVA');
  });

  it('returns empty string when no master and no vertical', () => {
    expect(composeAudience(null, null)).toBe('');
  });
});
