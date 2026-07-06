import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import {
  DEFAULT_EMAIL_SEQUENCE, getEmailSequence, setEmailSequence,
  renderSequenceEmail, leadFirstName, EMAIL_SEQUENCE_KEY,
} from '@/lib/outreach/sequence';

function settingsDb() {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)`);
  return db;
}

describe('default sequence', () => {
  it('has 5 steps in order with growing day offsets', () => {
    expect(DEFAULT_EMAIL_SEQUENCE.map((s) => s.step)).toEqual([1, 2, 3, 4, 5]);
    expect(DEFAULT_EMAIL_SEQUENCE.map((s) => s.dayOffset)).toEqual([0, 3, 7, 11, 15]);
  });

  it('obeys the pitch rules: no long dashes, audit-only offer, opt-out everywhere, no mailing address', () => {
    for (const s of DEFAULT_EMAIL_SEQUENCE) {
      const text = s.subject + s.body;
      expect(text).not.toMatch(/[—–]/); // em/en dash
      expect(text).not.toContain('Thistle Court');
      expect(s.body).toContain('Reply "no thanks"');
      // Phil's rule (2026-07-06): every email pitches the audit and only the
      // audit, with the full terms: price, $10k guarantee.
      expect(s.body).toContain('AI Opportunity Audit');
      expect(s.body).toContain('$1,000');
      expect(s.body).toContain('$10,000');
    }
  });
});

describe('getEmailSequence / setEmailSequence', () => {
  it('falls back to the default when unset or malformed', () => {
    const db = settingsDb();
    expect(getEmailSequence(db)).toEqual(DEFAULT_EMAIL_SEQUENCE);
    db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?)').run(EMAIL_SEQUENCE_KEY, 'not json');
    expect(getEmailSequence(db)).toEqual(DEFAULT_EMAIL_SEQUENCE);
    db.prepare('UPDATE app_settings SET value = ? WHERE key = ?').run('[{"bad": true}]', EMAIL_SEQUENCE_KEY);
    expect(getEmailSequence(db)).toEqual(DEFAULT_EMAIL_SEQUENCE);
  });

  it('round-trips an operator override sorted by step', () => {
    const db = settingsDb();
    const custom = [
      { step: 2, dayOffset: 5, subject: 'b', body: 'B' },
      { step: 1, dayOffset: 0, subject: 'a', body: 'A' },
    ];
    setEmailSequence(db, custom);
    expect(getEmailSequence(db).map((s) => s.subject)).toEqual(['a', 'b']);
  });
});

describe('renderSequenceEmail', () => {
  const step = DEFAULT_EMAIL_SEQUENCE[0];

  it('merges first name and company', () => {
    const { body } = renderSequenceEmail(step, { business_name: 'Acme HVAC', contact_person: 'Brett Boston' });
    expect(body.startsWith('Brett,')).toBe(true);
    expect(body).toContain('for Acme HVAC?');
    expect(body).not.toContain('[First Name]');
    expect(body).not.toContain('[Company]');
  });

  it('drops the salutation line when no first name on file (never invents)', () => {
    const { body } = renderSequenceEmail(step, { business_name: 'Acme HVAC', contact_person: null });
    expect(body).not.toContain('[First Name]');
    expect(body.startsWith("You've probably been pitched")).toBe(true);
  });

  it('falls back to "your business" when business name is blank', () => {
    const { body } = renderSequenceEmail(step, { business_name: '  ', contact_person: 'Jo Smith' });
    expect(body).toContain('for your business?');
  });

  it('rejects junk contact names', () => {
    expect(leadFirstName({ business_name: null, contact_person: '- -' })).toBeNull();
    expect(leadFirstName({ business_name: null, contact_person: 'J' })).toBeNull();
    expect(leadFirstName({ business_name: null, contact_person: 'Daryl Bridges' })).toBe('Daryl');
  });
});
