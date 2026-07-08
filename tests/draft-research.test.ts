import { describe, it, expect, vi, beforeEach } from 'vitest';

const askClaude = vi.fn(async () => 'draft text');
vi.mock('@/lib/claude', () => ({
  askClaude: (...args: unknown[]) => askClaude(...args),
  askClaudeWithWebSearch: vi.fn(),
  isClaudeConfigured: () => true,
}));

import { generateDraft } from '@/lib/outreach/draft';
import type { OutreachLead } from '@/lib/queries/outreach-lead-queries';

// getOutreachPitch reads app_settings; use a real in-memory-ish db
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { initDb } from '@/lib/db';

function lead(extra: Partial<OutreachLead>): OutreachLead {
  return {
    id: 1, business_name: 'Acme Lawn Care', contact_person: 'Bob',
    city: 'Hendersonville', state: 'TN', website: null, segment: null,
    category: 'Landscaping', employee_min: null, employee_max: null,
    lane: null, research_notes: null, researched_at: null,
    ...extra,
  } as OutreachLead;
}

describe('generateDraft research injection', () => {
  let db: ReturnType<typeof initDb>;
  beforeEach(() => {
    askClaude.mockClear();
    const dir = mkdtempSync(path.join(tmpdir(), 'cp-draft-research-'));
    db = initDb(path.join(dir, 'test.db'));
  });

  it('includes RESEARCHED FACTS and weaving rules when notes exist', async () => {
    await generateDraft(db, lead({ research_notes: '- They won Best of Sumner 2026 (https://x.example)' }), 'email');
    const [system, user] = askClaude.mock.calls[0] as unknown as [string, string];
    expect(user).toContain('RESEARCHED FACTS');
    expect(user).toContain('Best of Sumner');
    expect(system).toContain('at most two');
    expect(system).toContain('source URLs');
  });

  it('omits the section for the sentinel or missing notes', async () => {
    await generateDraft(db, lead({ research_notes: 'NOTHING FOUND' }), 'email');
    await generateDraft(db, lead({}), 'email');
    for (const call of askClaude.mock.calls) {
      const [system, user] = call as unknown as [string, string];
      expect(user).not.toContain('RESEARCHED FACTS');
      expect(system).not.toContain('RESEARCHED FACTS');
    }
  });
});
