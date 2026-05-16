import { describe, it, expect } from 'vitest';
import { buildAlertEmail, buildDigestEmail } from '@/lib/email-templates';

describe('buildAlertEmail', () => {
  it('includes title and message in output', () => {
    const html = buildAlertEmail('Server Down', 'api.example.com is not responding', '/ops/1');
    expect(html).toContain('Server Down');
    expect(html).toContain('api.example.com is not responding');
    expect(html).toContain('/ops/1');
  });

  it('handles null message and link', () => {
    const html = buildAlertEmail('Test Alert', null, null);
    expect(html).toContain('Test Alert');
    expect(html).toContain('CommandPost');
  });
});

describe('buildDigestEmail', () => {
  it('groups items by type', () => {
    const items = [
      { title: 'Invoice #101 overdue', message: '$500', link: '/finances/invoices/1', type: 'invoice_overdue' },
      { title: 'Invoice #102 overdue', message: '$300', link: '/finances/invoices/2', type: 'invoice_overdue' },
      { title: 'Follow up with Acme', message: null, link: '/pipeline/5', type: 'follow_up_due' },
    ];
    const html = buildDigestEmail(items);
    expect(html).toContain('invoice overdue');
    expect(html).toContain('follow up due');
    expect(html).toContain('3 notifications');
  });

  it('returns empty string for no items', () => {
    expect(buildDigestEmail([])).toBe('');
  });
});
