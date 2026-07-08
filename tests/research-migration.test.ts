import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { initDb } from '@/lib/db';

describe('research migration', () => {
  it('adds research_notes and researched_at to leads', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'cp-research-mig-'));
    const db = initDb(path.join(dir, 'test.db'));
    const cols = new Set(
      (db.prepare('PRAGMA table_info(leads)').all() as { name: string }[]).map((c) => c.name)
    );
    expect(cols.has('research_notes')).toBe(true);
    expect(cols.has('researched_at')).toBe(true);
    db.close();
  });
});
