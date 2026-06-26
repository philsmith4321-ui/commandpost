export const EMAIL_STATUS = {
  DRAFT: 'draft',
  QUEUED: 'queued',
  SENT: 'sent',
  SKIPPED: 'skipped',
  FAILED: 'failed',
} as const;
export type EmailStatus = (typeof EMAIL_STATUS)[keyof typeof EMAIL_STATUS];

const DEFAULT_SUBJECT = 'Quick note from RekindleLeads';

// Split a generated email into a subject line and body. Drafts start with
// "Subject: ..." then a blank line then the body (see outreach/draft.ts email shape).
export function parseEmail(draft: string): { subject: string; body: string } {
  const text = (draft ?? '').replace(/\r\n/g, '\n').trim();
  const m = text.match(/^subject:\s*(.+?)\n\s*\n([\s\S]*)$/i);
  if (m) return { subject: m[1].trim(), body: m[2].trim() };
  const single = text.match(/^subject:\s*(.+)$/i);
  if (single) return { subject: single[1].trim(), body: '' };
  return { subject: DEFAULT_SUBJECT, body: text };
}

// Deterministic per-day send target in [10,15]. Seeded by the YYYY-MM-DD string so
// every tick that day agrees on the cap (no DB state needed).
export function dailyTarget(isoDate: string): number {
  let h = 0;
  for (let i = 0; i < isoDate.length; i++) h = (h * 31 + isoDate.charCodeAt(i)) >>> 0;
  return 10 + (h % 6); // 10..15
}

export interface SendableLead {
  email: string | null;
  email_status: string | null;
  do_not_email: number | null;
  replied_at: string | null;
  email_sent_at_q: string | null;
}

// Defense in depth: a lead is sendable only if queued, has an address, isn't
// suppressed, hasn't replied, and hasn't already been sent.
export function isSendable(l: SendableLead): boolean {
  return (
    !!l.email && l.email.trim() !== '' &&
    l.email_status === EMAIL_STATUS.QUEUED &&
    !l.do_not_email &&
    !l.replied_at &&
    !l.email_sent_at_q
  );
}
