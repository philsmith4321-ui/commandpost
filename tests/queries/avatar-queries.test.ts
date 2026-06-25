import { describe, it, expect, beforeEach } from 'vitest';
import { initDb } from '@/lib/db';
import { createAvatar, getAvatar, listAvatars, updateAvatar } from '@/lib/queries/avatar-queries';
import type Database from 'better-sqlite3';

let db: Database.Database;
beforeEach(() => { db = initDb(':memory:'); });

describe('createAvatar with structured fields', () => {
  it('round-trips arrays and scalars', () => {
    const id = createAvatar(db, {
      name: 'Fee-Only RIA',
      persona: 'David, the Fiduciary',
      proof_point: 'PWI',
      writing_target: 'Write to a fee-only fiduciary…',
      pains: ['Content marketing is a slog', 'Compliance eats hours'],
      objections: ['Compliance / SEC'],
      vocabulary: ['fiduciary', 'AUM'],
      channels: ['LinkedIn', 'email'],
    });
    const a = getAvatar(db, id)!;
    expect(a.persona).toBe('David, the Fiduciary');
    expect(a.proof_point).toBe('PWI');
    expect(a.pains).toEqual(['Content marketing is a slog', 'Compliance eats hours']);
    expect(a.objections).toEqual(['Compliance / SEC']);
    expect(a.vocabulary).toEqual(['fiduciary', 'AUM']);
    expect(a.channels).toEqual(['LinkedIn', 'email']);
  });

  it('defaults arrays to [] when omitted (legacy-style avatar)', () => {
    const id = createAvatar(db, { name: 'Old Persona', summary: 'sparse' });
    const a = getAvatar(db, id)!;
    expect(a.pains).toEqual([]);
    expect(a.vocabulary).toEqual([]);
    expect(a.persona).toBeNull();
  });
});

describe('updateAvatar with structured fields', () => {
  it('overwrites arrays', () => {
    const id = createAvatar(db, { name: 'X', vocabulary: ['a'] });
    updateAvatar(db, id, { name: 'X', vocabulary: ['b', 'c'] });
    expect(getAvatar(db, id)!.vocabulary).toEqual(['b', 'c']);
  });
});

describe('listAvatars', () => {
  it('parses arrays for every row', () => {
    createAvatar(db, { name: 'A', pains: ['p1'] });
    const all = listAvatars(db);
    expect(all[0].pains).toEqual(['p1']);
  });
});
