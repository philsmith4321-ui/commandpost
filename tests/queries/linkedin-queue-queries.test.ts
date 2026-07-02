import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { listLinkedInQueue } from '@/lib/queries/linkedin-queue-queries';

function freshDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE leads (
      id INTEGER PRIMARY KEY, business_name TEXT, contact_person TEXT,
      city TEXT, state TEXT, category TEXT, socials TEXT,
      draft_linkedin TEXT, replied_at TEXT
    );
    CREATE TABLE outreach_touches (
      id INTEGER PRIMARY KEY, lead_id INTEGER, channel TEXT,
      sent_at TEXT DEFAULT (datetime('now')), note TEXT
    );
  `);
  const ins = db.prepare('INSERT INTO leads (business_name, contact_person, draft_linkedin) VALUES (?,?,?)');
  ins.run('Zeta Co', 'Zoe B', 'Hi Zoe');
  ins.run('Acme Co', 'Al A', 'Hi Al');
  ins.run('NoContact Co', null, 'Hi there'); // no named contact -> excluded
  ins.run('NoDraft Co', 'Nina D', null);     // no draft -> excluded
  return db;
}

describe('listLinkedInQueue', () => {
  let db: Database.Database;
  beforeEach(() => { db = freshDb(); });

  it('lists only drafted leads with a named contact, A-Z', () => {
    expect(listLinkedInQueue(db).map((l) => l.business_name)).toEqual(['Acme Co', 'Zeta Co']);
  });

  it('surfaces the linkedin touch stamp so sent leads can be split out', () => {
    db.prepare("INSERT INTO outreach_touches (lead_id, channel) VALUES (2, 'linkedin')").run();
    db.prepare("INSERT INTO outreach_touches (lead_id, channel) VALUES (1, 'email')").run();
    const rows = listLinkedInQueue(db);
    expect(rows.find((l) => l.id === 2)?.linkedin_sent_at).toBeTruthy();
    expect(rows.find((l) => l.id === 1)?.linkedin_sent_at).toBeNull();
  });
});
