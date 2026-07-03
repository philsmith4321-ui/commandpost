import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { initDb } from '@/lib/db';

describe('letter batch migration', () => {
  it('adds letter_status, letter_sent_at_q, letter_batch_date to leads', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'cp-letter-mig-'));
    const db = initDb(path.join(dir, 'test.db'));
    const cols = new Set(
      (db.prepare('PRAGMA table_info(leads)').all() as { name: string }[]).map((c) => c.name)
    );
    expect(cols.has('letter_status')).toBe(true);
    expect(cols.has('letter_sent_at_q')).toBe(true);
    expect(cols.has('letter_batch_date')).toBe(true);
    db.close();
  });
});
