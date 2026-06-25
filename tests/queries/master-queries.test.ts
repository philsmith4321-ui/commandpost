import { describe, it, expect, beforeEach } from 'vitest';
import { initDb } from '@/lib/db';
import { getMasterProfile, upsertMasterProfile } from '@/lib/queries/master-queries';
import type Database from 'better-sqlite3';

let db: Database.Database;
beforeEach(() => { db = initDb(':memory:'); });

describe('getMasterProfile', () => {
  it('returns null when unset', () => {
    expect(getMasterProfile(db)).toBeNull();
  });
});

describe('upsertMasterProfile', () => {
  it('inserts then reads back with parsed arrays', () => {
    upsertMasterProfile(db, {
      identity: 'Owner-operator',
      tone: 'Direct',
      objections: [{ objection: 'Sounds robotic', counter: 'Show voice fidelity' }],
      trust_builders: ['Real working thing', 'Plain English'],
    });
    const m = getMasterProfile(db)!;
    expect(m.id).toBe(1);
    expect(m.identity).toBe('Owner-operator');
    expect(m.objections).toEqual([{ objection: 'Sounds robotic', counter: 'Show voice fidelity' }]);
    expect(m.trust_builders).toEqual(['Real working thing', 'Plain English']);
  });

  it('updates the same singleton row (id stays 1)', () => {
    upsertMasterProfile(db, { identity: 'first' });
    upsertMasterProfile(db, { identity: 'second', wants: 'time back' });
    const m = getMasterProfile(db)!;
    expect(m.id).toBe(1);
    expect(m.identity).toBe('second');
    expect(m.wants).toBe('time back');
    const count = db.prepare('SELECT COUNT(*) c FROM master_profile').get() as { c: number };
    expect(count.c).toBe(1);
  });
});
