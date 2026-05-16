import { describe, it, expect, beforeEach } from 'vitest';
import { initDb } from '@/lib/db';
import {
  insertNotification,
  getUnreadCount,
  getRecentNotifications,
  markNotificationRead,
  markAllRead,
  getNotificationPreferences,
  upsertPreference,
  getDigestNotifications,
} from '@/lib/queries/notification-queries';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeEach(() => {
  db = initDb(':memory:');
});

describe('insertNotification', () => {
  it('inserts and returns id', () => {
    const id = insertNotification(db, { type: 'invoice_paid', title: 'Invoice paid', message: '$500', link: '/finances/invoices/1' });
    expect(id).toBe(1);
  });
});

describe('getUnreadCount', () => {
  it('counts unread notifications', () => {
    insertNotification(db, { type: 'invoice_paid', title: 'A', message: null, link: null });
    insertNotification(db, { type: 'invoice_paid', title: 'B', message: null, link: null });
    db.exec("UPDATE notifications SET is_read = 1 WHERE id = 1");
    expect(getUnreadCount(db)).toBe(1);
  });
});

describe('getRecentNotifications', () => {
  it('returns notifications ordered by created_at desc', () => {
    insertNotification(db, { type: 'invoice_paid', title: 'First', message: null, link: null });
    insertNotification(db, { type: 'server_down', title: 'Second', message: null, link: null });
    const results = getRecentNotifications(db, 10);
    expect(results).toHaveLength(2);
    expect(results[0].title).toBe('Second');
  });
});

describe('markNotificationRead', () => {
  it('marks a single notification as read', () => {
    insertNotification(db, { type: 'invoice_paid', title: 'Test', message: null, link: null });
    markNotificationRead(db, 1);
    expect(getUnreadCount(db)).toBe(0);
  });
});

describe('markAllRead', () => {
  it('marks all as read', () => {
    insertNotification(db, { type: 'invoice_paid', title: 'A', message: null, link: null });
    insertNotification(db, { type: 'invoice_paid', title: 'B', message: null, link: null });
    markAllRead(db);
    expect(getUnreadCount(db)).toBe(0);
  });
});

describe('getNotificationPreferences', () => {
  it('returns defaults for all types when table is empty', () => {
    const prefs = getNotificationPreferences(db);
    expect(prefs.length).toBeGreaterThan(0);
    const serverDown = prefs.find(p => p.notification_type === 'server_down');
    expect(serverDown?.email_delivery).toBe('immediate');
  });
});

describe('upsertPreference', () => {
  it('inserts and updates preference', () => {
    upsertPreference(db, 'invoice_paid', 'none');
    const prefs = getNotificationPreferences(db);
    const pref = prefs.find(p => p.notification_type === 'invoice_paid');
    expect(pref?.email_delivery).toBe('none');
  });
});

describe('getDigestNotifications', () => {
  it('returns unread notifications with digest preference', () => {
    upsertPreference(db, 'invoice_paid', 'digest');
    upsertPreference(db, 'server_down', 'immediate');
    insertNotification(db, { type: 'invoice_paid', title: 'Paid', message: null, link: null });
    insertNotification(db, { type: 'server_down', title: 'Down', message: null, link: null });
    const digest = getDigestNotifications(db);
    expect(digest).toHaveLength(1);
    expect(digest[0].title).toBe('Paid');
  });
});
