import { describe, it, expect } from 'vitest';
import { parseEmail, dailyTarget, isSendable, EMAIL_STATUS } from '@/lib/outreach/email-queue';

describe('parseEmail', () => {
  it('splits a "Subject:" first line from the body', () => {
    const r = parseEmail('Subject: the honest version\n\nHi Sam,\nbody here');
    expect(r.subject).toBe('the honest version');
    expect(r.body).toBe('Hi Sam,\nbody here');
  });
  it('falls back to a default subject when none present', () => {
    const r = parseEmail('Hi Sam,\nno subject line');
    expect(r.subject).toBe('Quick note from RekindleLeads');
    expect(r.body).toBe('Hi Sam,\nno subject line');
  });
});

describe('dailyTarget', () => {
  it('is deterministic per date and within 22..28', () => {
    const a = dailyTarget('2026-06-29');
    const b = dailyTarget('2026-06-29');
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(22);
    expect(a).toBeLessThanOrEqual(28);
  });
  it('varies across dates', () => {
    const vals = ['2026-06-29', '2026-06-30', '2026-07-01', '2026-07-02'].map(dailyTarget);
    expect(new Set(vals).size).toBeGreaterThan(1);
  });
});

describe('isSendable', () => {
  const base = { email: 'a@b.com', email_status: EMAIL_STATUS.QUEUED, do_not_email: 0, replied_at: null, email_sent_at_q: null };
  it('true for a clean queued lead with an email', () => {
    expect(isSendable(base)).toBe(true);
  });
  it('false when suppressed / replied / already sent / not queued / no email', () => {
    expect(isSendable({ ...base, do_not_email: 1 })).toBe(false);
    expect(isSendable({ ...base, replied_at: '2026-06-28' })).toBe(false);
    expect(isSendable({ ...base, email_sent_at_q: '2026-06-28' })).toBe(false);
    expect(isSendable({ ...base, email_status: EMAIL_STATUS.DRAFT })).toBe(false);
    expect(isSendable({ ...base, email: null })).toBe(false);
  });
});
