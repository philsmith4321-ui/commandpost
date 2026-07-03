import { describe, it, expect } from 'vitest';
import type { LetterLead } from '@/lib/queries/letter-batch-queries';
import {
  recipientName, formatEnvelope, centralDateParts, composeLetterBatchEmail,
} from '@/lib/outreach/letter-batch';

function lead(over: Partial<LetterLead> = {}): LetterLead {
  return {
    id: 1, business_name: 'Acme HVAC', contact_person: 'Brett Boston',
    street: '12 Main St', city: 'Hendersonville', state: 'TN', postal_code: '37075',
    draft_letter: 'Hi Brett, short letter body.', email_queued_at: '2026-06-01 10:00:00',
    lane: null, segment: null, category: null, employee_min: null, employee_max: null, website: null,
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
