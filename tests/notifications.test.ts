import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initDb } from '@/lib/db';
import { createNotification } from '@/lib/notifications';
import { getUnreadCount } from '@/lib/queries/notification-queries';
import type Database from 'better-sqlite3';

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

let db: Database.Database;

beforeEach(() => {
  db = initDb(':memory:');
  vi.clearAllMocks();
});

describe('createNotification', () => {
  it('inserts notification into database', async () => {
    await createNotification(db, { type: 'invoice_paid', title: 'Invoice paid', message: '$500', link: '/finances/invoices/1' });
    expect(getUnreadCount(db)).toBe(1);
  });

  it('sends immediate email for forced types', async () => {
    const { sendEmail } = await import('@/lib/email');
    process.env.NOTIFICATION_TO_EMAIL = 'test@example.com';
    await createNotification(db, { type: 'server_down', title: 'Server down', message: 'api.example.com', link: '/ops/1' });
    expect(sendEmail).toHaveBeenCalled();
    delete process.env.NOTIFICATION_TO_EMAIL;
  });

  it('does not send email for digest types', async () => {
    const { sendEmail } = await import('@/lib/email');
    await createNotification(db, { type: 'invoice_paid', title: 'Paid', message: null, link: null });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('sends email when preference is immediate', async () => {
    const { sendEmail } = await import('@/lib/email');
    process.env.NOTIFICATION_TO_EMAIL = 'test@example.com';
    db.prepare("INSERT INTO notification_preferences (notification_type, email_delivery) VALUES ('invoice_paid', 'immediate')").run();
    await createNotification(db, { type: 'invoice_paid', title: 'Paid', message: null, link: null });
    expect(sendEmail).toHaveBeenCalled();
    delete process.env.NOTIFICATION_TO_EMAIL;
  });
});
