import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { getSetting, setSetting, getAllSettings } from '@/lib/queries/settings-queries';

function makeDb() {
  const db = new Database(':memory:');
  db.exec('CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT)');
  return db;
}

describe('settings-queries', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
  });

  it('round-trips a string value', () => {
    setSetting(db, 'outreach_pitch', 'hello pitch');
    expect(getSetting(db, 'outreach_pitch')).toBe('hello pitch');
  });

  it('returns null for a missing key', () => {
    expect(getSetting(db, 'nope')).toBeNull();
  });

  // Direct sqlite writes (e.g. readfile() in an ops session) can store the value
  // as a BLOB; better-sqlite3 then returns a Buffer, which blanked the pitch box.
  it('coerces a BLOB-stored value to a string', () => {
    db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?)').run(
      'outreach_pitch',
      Buffer.from('blob pitch', 'utf8'),
    );
    const value = getSetting(db, 'outreach_pitch');
    expect(typeof value).toBe('string');
    expect(value).toBe('blob pitch');
  });

  it('getAllSettings coerces BLOB values to strings', () => {
    setSetting(db, 'plain', 'text value');
    db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?)').run(
      'blobbed',
      Buffer.from('blob value', 'utf8'),
    );
    const all = getAllSettings(db);
    expect(all.plain).toBe('text value');
    expect(all.blobbed).toBe('blob value');
    expect(typeof all.blobbed).toBe('string');
  });
});
