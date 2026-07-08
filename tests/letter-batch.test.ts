import { describe, it, expect, vi } from 'vitest';
import Database from 'better-sqlite3';
import type { LetterLead } from '@/lib/queries/letter-batch-queries';
import {
  recipientName, formatEnvelope, centralDateParts, composeLetterBatchEmail,
  runLetterBatchTick, LETTER_BATCH_ENABLED_KEY, LETTER_LAST_BATCH_DATE_KEY, LETTER_BATCH_RECIPIENT_KEY,
} from '@/lib/outreach/letter-batch';
import { setSetting, getSetting } from '@/lib/queries/settings-queries';

function lead(over: Partial<LetterLead> = {}): LetterLead {
  return {
    id: 1, business_name: 'Acme HVAC', contact_person: 'Brett Boston',
    street: '12 Main St', city: 'Hendersonville', state: 'TN', postal_code: '37075',
    draft_letter: 'Hi Brett, short letter body.', email_queued_at: '2026-06-01 10:00:00',
    lane: null, segment: null, category: null, employee_min: null, employee_max: null, website: null,
    research_notes: null, researched_at: null,
    ...over,
  };
}

describe('recipientName', () => {
  it('uses contact_person, falling back to business name', () => {
    expect(recipientName(lead())).toBe('Brett Boston');
    expect(recipientName(lead({ contact_person: null }))).toBe('Acme HVAC');
    expect(recipientName(lead({ contact_person: '  ' }))).toBe('Acme HVAC');
  });
});

describe('formatEnvelope', () => {
  it('renders name, business, street, city-state-zip', () => {
    expect(formatEnvelope(lead())).toBe('Brett Boston\nAcme HVAC\n12 Main St\nHendersonville, TN 37075');
  });
  it('does not repeat the business name when it is the recipient', () => {
    expect(formatEnvelope(lead({ contact_person: null })))
      .toBe('Acme HVAC\n12 Main St\nHendersonville, TN 37075');
  });
});

describe('centralDateParts', () => {
  it('returns the Central-time ISO date and a human label', () => {
    // 2026-07-03 03:00 UTC is still 2026-07-02 in Chicago (CDT, UTC-5)
    const parts = centralDateParts(new Date('2026-07-03T03:00:00Z'));
    expect(parts.isoDate).toBe('2026-07-02');
    expect(parts.label).toBe('July 2');
  });
});

describe('composeLetterBatchEmail', () => {
  it('numbers each company with envelope + letter text and counts them in the subject', () => {
    const leads = [lead(), lead({ id: 2, business_name: 'Beta Roofing', contact_person: null, draft_letter: 'Hi there, second letter.' })];
    const { subject, text } = composeLetterBatchEmail(leads, 'July 3');
    expect(subject).toBe('Handwritten letters — July 3 (2 companies)');
    expect(text).toContain('LETTER 1 of 2 — Acme HVAC');
    expect(text).toContain('LETTER 2 of 2 — Beta Roofing');
    expect(text).toContain('Brett Boston\nAcme HVAC\n12 Main St\nHendersonville, TN 37075');
    expect(text).toContain('Hi Brett, short letter body.');
    expect(text).toContain('1004 Thistle Court, Hendersonville, TN 37075'); // return address
  });
  it('uses singular "company" for a batch of one', () => {
    expect(composeLetterBatchEmail([lead()], 'July 3').subject)
      .toBe('Handwritten letters — July 3 (1 company)');
  });
});

function tickDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE leads (
      id INTEGER PRIMARY KEY, business_name TEXT, contact_person TEXT,
      street TEXT, city TEXT, state TEXT, postal_code TEXT,
      lane TEXT, segment TEXT, category TEXT,
      employee_min INTEGER, employee_max INTEGER, website TEXT,
      email_status TEXT, email_queued_at TEXT, sequence_enrolled_at TEXT,
      do_not_email INTEGER NOT NULL DEFAULT 0,
      draft_letter TEXT, letter_status TEXT, letter_sent_at_q TEXT,
      letter_batch_date TEXT, updated_at TEXT,
      research_notes TEXT, researched_at TEXT
    );
    CREATE TABLE outreach_touches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      channel TEXT NOT NULL CHECK(channel IN ('letter','email','phone','linkedin','fb')),
      sent_at TEXT NOT NULL DEFAULT (datetime('now')),
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT);
  `);
  const ins = db.prepare(`INSERT INTO leads
    (business_name, contact_person, street, city, state, postal_code, email_status, email_queued_at, draft_letter)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  ins.run('Acme HVAC', 'Brett Boston', '12 Main St', 'Hendersonville', 'TN', '37075', 'queued', '2026-06-01 10:00:00', 'Existing letter draft.');
  ins.run('Beta Roofing', null, '9 Oak Ave', 'Gallatin', 'TN', '37066', 'queued', '2026-06-02 10:00:00', null);
  return db;
}

// 2026-07-03T14:00Z = 9am Central on July 3
const NOW = new Date('2026-07-03T14:00:00Z');
const FROM = 'phil@rekindleleads.com';
const okTransport = () => ({ sendMail: vi.fn().mockResolvedValue({}) });
const stubDraft = vi.fn().mockResolvedValue('Generated letter body.');

describe('runLetterBatchTick', () => {
  it('does nothing when the enabled flag is off', async () => {
    const db = tickDb();
    const transport = okTransport();
    const r = await runLetterBatchTick(db, { transport, now: NOW, from: FROM, draftFn: stubDraft });
    expect(r.reason).toBe('disabled');
    expect(transport.sendMail).not.toHaveBeenCalled();
  });

  it('sends one email to the default recipient, drafts missing letters, marks leads, stamps the date', async () => {
    const db = tickDb();
    setSetting(db, LETTER_BATCH_ENABLED_KEY, '1');
    const transport = okTransport();
    const r = await runLetterBatchTick(db, { transport, now: NOW, from: FROM, draftFn: stubDraft });
    expect(r).toMatchObject({ sent: 2, skippedDrafts: 0, dryRun: false, recipient: 'thecarolinem@icloud.com' });
    expect(transport.sendMail).toHaveBeenCalledTimes(1);
    const mail = transport.sendMail.mock.calls[0][0];
    expect(mail.to).toBe('thecarolinem@icloud.com');
    expect(mail.text).toContain('Existing letter draft.');   // pre-existing draft reused
    expect(mail.text).toContain('Generated letter body.');   // missing draft generated
    expect(db.prepare("SELECT COUNT(*) n FROM leads WHERE letter_status='sent'").get()).toEqual({ n: 2 });
    expect(db.prepare("SELECT COUNT(*) n FROM outreach_touches WHERE channel='letter'").get()).toEqual({ n: 2 });
    expect(getSetting(db, LETTER_LAST_BATCH_DATE_KEY)).toBe('2026-07-03');
  });

  it('honors the letter_batch_recipient setting', async () => {
    const db = tickDb();
    setSetting(db, LETTER_BATCH_ENABLED_KEY, '1');
    setSetting(db, LETTER_BATCH_RECIPIENT_KEY, 'someone@else.com');
    const transport = okTransport();
    await runLetterBatchTick(db, { transport, now: NOW, from: FROM, draftFn: stubDraft });
    expect(transport.sendMail.mock.calls[0][0].to).toBe('someone@else.com');
  });

  it('refuses a second real batch on the same Central date', async () => {
    const db = tickDb();
    setSetting(db, LETTER_BATCH_ENABLED_KEY, '1');
    setSetting(db, LETTER_LAST_BATCH_DATE_KEY, '2026-07-03');
    const transport = okTransport();
    const r = await runLetterBatchTick(db, { transport, now: NOW, from: FROM, draftFn: stubDraft });
    expect(r.reason).toBe('already-sent-today');
    expect(transport.sendMail).not.toHaveBeenCalled();
  });

  it('dry run sends to the override address and mutates no lead state', async () => {
    const db = tickDb();
    const transport = okTransport();
    const r = await runLetterBatchTick(db, {
      transport, now: NOW, from: FROM, dryRun: true, to: 'philsmith4321@gmail.com', draftFn: stubDraft,
    });
    expect(r).toMatchObject({ sent: 2, dryRun: true, recipient: 'philsmith4321@gmail.com' });
    expect(transport.sendMail.mock.calls[0][0].to).toBe('philsmith4321@gmail.com');
    expect(db.prepare("SELECT COUNT(*) n FROM leads WHERE letter_status='sent'").get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT COUNT(*) n FROM outreach_touches').get()).toEqual({ n: 0 });
    expect(getSetting(db, LETTER_LAST_BATCH_DATE_KEY)).toBeNull();
    // dry run works even with the enabled flag off (it defaults to off here)
  });

  it('a lead whose draft fails is skipped and stays in the pool; the batch ships without it', async () => {
    const db = tickDb();
    setSetting(db, LETTER_BATCH_ENABLED_KEY, '1');
    const transport = okTransport();
    const failDraft = vi.fn().mockResolvedValue(null);
    const r = await runLetterBatchTick(db, { transport, now: NOW, from: FROM, draftFn: failDraft });
    expect(r).toMatchObject({ sent: 1, skippedDrafts: 1 });
    expect(db.prepare('SELECT letter_status FROM leads WHERE id=2').get()).toEqual({ letter_status: null });
  });

  it('returns empty and sends nothing when no leads are eligible', async () => {
    const db = tickDb();
    setSetting(db, LETTER_BATCH_ENABLED_KEY, '1');
    db.exec("UPDATE leads SET letter_status='sent'");
    const transport = okTransport();
    const r = await runLetterBatchTick(db, { transport, now: NOW, from: FROM, draftFn: stubDraft });
    expect(r.reason).toBe('empty');
    expect(transport.sendMail).not.toHaveBeenCalled();
  });

  it('marks nothing when the send fails', async () => {
    const db = tickDb();
    setSetting(db, LETTER_BATCH_ENABLED_KEY, '1');
    const transport = { sendMail: vi.fn().mockRejectedValue(new Error('gmail-api 500')) };
    const r = await runLetterBatchTick(db, { transport, now: NOW, from: FROM, draftFn: stubDraft });
    expect(r.reason).toBe('error');
    expect(r.error).toContain('gmail-api 500');
    expect(db.prepare("SELECT COUNT(*) n FROM leads WHERE letter_status='sent'").get()).toEqual({ n: 0 });
    expect(getSetting(db, LETTER_LAST_BATCH_DATE_KEY)).toBeNull();
  });

  it('researches a lead before drafting its letter and passes notes to the draft', async () => {
    // Only the undrafted lead (Beta Roofing, id=2) needs research; Acme HVAC
    // already has draft_letter set and short-circuits before drafting/research.
    const db = tickDb();
    setSetting(db, LETTER_BATCH_ENABLED_KEY, '1');
    const transport = okTransport();
    const researched: number[] = [];
    const seenNotes: (string | null)[] = [];
    const r = await runLetterBatchTick(db, {
      transport, now: NOW, from: FROM,
      researchFn: async (_d, l) => {
        researched.push(l.id);
        return '- researched fact (https://x.example)';
      },
      draftFn: async (_d, l) => {
        seenNotes.push((l as unknown as { research_notes?: string | null }).research_notes ?? null);
        return 'letter text';
      },
    });
    expect(r.sent).toBe(2);
    expect(researched).toHaveLength(1);
    expect(researched[0]).toBe(2);
    expect(seenNotes).toHaveLength(1);
    expect(seenNotes[0]).toContain('researched fact');
  });
});
