import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { initDb } from '@/lib/db';
import {
  NOTHING_FOUND, usableResearch, isResearchFresh, researchLead, ensureFreshResearch,
} from '@/lib/outreach/research';

function makeDb() {
  const dir = mkdtempSync(path.join(tmpdir(), 'cp-research-'));
  const db = initDb(path.join(dir, 'test.db'));
  db.prepare(
    `INSERT INTO leads (business_name, contact_person, city, state, website, source)
     VALUES ('Acme Lawn Care', 'Bob', 'Hendersonville', 'TN', 'https://acmelawn.example', 'other')`
  ).run();
  const lead = db.prepare('SELECT * FROM leads WHERE id = 1').get() as never;
  return { db, lead };
}

describe('usableResearch', () => {
  it('returns null for empty, whitespace, or the sentinel', () => {
    expect(usableResearch(null)).toBeNull();
    expect(usableResearch('  ')).toBeNull();
    expect(usableResearch(NOTHING_FOUND)).toBeNull();
    expect(usableResearch(`  ${NOTHING_FOUND}\n`)).toBeNull();
  });
  it('returns trimmed notes otherwise', () => {
    expect(usableResearch(' - fact (url)\n')).toBe('- fact (url)');
  });
});

describe('isResearchFresh', () => {
  const now = new Date('2026-07-08T12:00:00Z');
  it('true within 30 days, false outside or missing', () => {
    expect(isResearchFresh('2026-07-01T00:00:00Z', now)).toBe(true);
    expect(isResearchFresh('2026-05-01T00:00:00Z', now)).toBe(false);
    expect(isResearchFresh(null, now)).toBe(false);
  });
});

describe('researchLead', () => {
  it('stores notes + timestamp and returns them', async () => {
    const { db, lead } = makeDb();
    const notes = await researchLead(db, lead, async () => '- They opened a 2nd location (https://news.example)');
    expect(notes).toContain('2nd location');
    const row = db.prepare('SELECT research_notes, researched_at FROM leads WHERE id = 1').get() as {
      research_notes: string; researched_at: string;
    };
    expect(row.research_notes).toContain('2nd location');
    expect(row.researched_at).toBeTruthy();
    db.close();
  });

  it('stores the sentinel when the model finds nothing', async () => {
    const { db, lead } = makeDb();
    const notes = await researchLead(db, lead, async () => `${NOTHING_FOUND}`);
    expect(notes).toBe(NOTHING_FOUND);
    db.close();
  });

  it('returns null and writes nothing on ask failure', async () => {
    const { db, lead } = makeDb();
    const notes = await researchLead(db, lead, async () => null);
    expect(notes).toBeNull();
    const row = db.prepare('SELECT research_notes, researched_at FROM leads WHERE id = 1').get() as {
      research_notes: string | null; researched_at: string | null;
    };
    expect(row.research_notes).toBeNull();
    expect(row.researched_at).toBeNull();
    db.close();
  });
});

describe('ensureFreshResearch', () => {
  it('skips the ask when research is fresh and returns usable notes', async () => {
    const { db } = makeDb();
    db.prepare("UPDATE leads SET research_notes = '- cached fact', researched_at = datetime('now') WHERE id = 1").run();
    const lead = db.prepare('SELECT * FROM leads WHERE id = 1').get() as never;
    let called = 0;
    const notes = await ensureFreshResearch(db, lead, async () => { called++; return '- new'; });
    expect(notes).toBe('- cached fact');
    expect(called).toBe(0);
    db.close();
  });

  it('skips the ask when a fresh sentinel is stored, returning null', async () => {
    const { db } = makeDb();
    db.prepare("UPDATE leads SET research_notes = 'NOTHING FOUND', researched_at = datetime('now') WHERE id = 1").run();
    const lead = db.prepare('SELECT * FROM leads WHERE id = 1').get() as never;
    let called = 0;
    const notes = await ensureFreshResearch(db, lead, async () => { called++; return '- new'; });
    expect(notes).toBeNull();
    expect(called).toBe(0);
    db.close();
  });

  it('fails open: a throwing ask returns null', async () => {
    const { db, lead } = makeDb();
    const notes = await ensureFreshResearch(db, lead, async () => { throw new Error('boom'); });
    expect(notes).toBeNull();
    db.close();
  });
});
