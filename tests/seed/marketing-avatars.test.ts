import { describe, it, expect, beforeEach } from 'vitest';
import { initDb } from '@/lib/db';
import { seedMarketingAvatars } from '@/lib/seed/marketing-avatars';
import { getMasterProfile } from '@/lib/queries/master-queries';
import { listAvatars, createAvatar } from '@/lib/queries/avatar-queries';
import type Database from 'better-sqlite3';

let db: Database.Database;
beforeEach(() => { db = initDb(':memory:'); });

describe('seedMarketingAvatars', () => {
  it('seeds the master profile and 4 overlays', () => {
    seedMarketingAvatars(db);
    const m = getMasterProfile(db)!;
    expect(m.identity).toBeTruthy();
    expect(m.objections.length).toBe(5);
    const names = listAvatars(db).map((a) => a.name);
    expect(names).toContain('Fee-Only RIA / Financial Advisor');
    expect(names).toContain('Chiropractor / Clinic Owner');
    expect(names).toContain('Faith-Based Nonprofit Leader');
    expect(names).toContain('Home Services Owner');
  });

  it('is idempotent — running twice does not duplicate', () => {
    seedMarketingAvatars(db);
    seedMarketingAvatars(db);
    expect(listAvatars(db).length).toBe(4);
    const count = db.prepare('SELECT COUNT(*) c FROM master_profile').get() as { c: number };
    expect(count.c).toBe(1);
  });

  it('does not touch pre-existing avatars or overwrite an existing master', () => {
    createAvatar(db, { name: 'Pre-Retiree Pete', summary: 'legacy' });
    seedMarketingAvatars(db);
    const names = listAvatars(db).map((a) => a.name);
    expect(names).toContain('Pre-Retiree Pete');
    expect(listAvatars(db).length).toBe(5); // 1 legacy + 4 seeded
  });
});
