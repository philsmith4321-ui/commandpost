import type Database from 'better-sqlite3';
import type { Notification, NotificationType, EmailDelivery, NotificationPreference } from '@/lib/types';

interface InsertNotificationInput {
  type: NotificationType;
  title: string;
  message: string | null;
  link: string | null;
}

const FORCED_IMMEDIATE: NotificationType[] = ['server_down', 'server_recovered', 'client_health_critical'];

const DEFAULT_PREFERENCES: Record<NotificationType, EmailDelivery> = {
  server_down: 'immediate',
  server_recovered: 'immediate',
  client_health_critical: 'immediate',
  invoice_overdue: 'digest',
  invoice_paid: 'digest',
  deliverable_overdue: 'digest',
  follow_up_due: 'digest',
  lead_stage_changed: 'digest',
  time_invoiced: 'none',
  proposal_accepted: 'immediate',
  contract_expiring: 'digest',
};

export { FORCED_IMMEDIATE, DEFAULT_PREFERENCES };

export function insertNotification(db: Database.Database, input: InsertNotificationInput): number {
  const result = db.prepare(`
    INSERT INTO notifications (type, title, message, link)
    VALUES (@type, @title, @message, @link)
  `).run({
    type: input.type,
    title: input.title,
    message: input.message,
    link: input.link,
  });
  return Number(result.lastInsertRowid);
}

export function getUnreadCount(db: Database.Database): number {
  return (db.prepare('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0').get() as any).count;
}

export function getRecentNotifications(db: Database.Database, limit: number): Notification[] {
  return db.prepare('SELECT * FROM notifications ORDER BY created_at DESC, id DESC LIMIT ?').all(limit) as Notification[];
}

export function getNotificationsFiltered(
  db: Database.Database,
  filters: { type?: string; isRead?: boolean; startDate?: string; endDate?: string }
): Notification[] {
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters.type) {
    conditions.push('type = ?');
    params.push(filters.type);
  }
  if (filters.isRead !== undefined) {
    conditions.push('is_read = ?');
    params.push(filters.isRead ? 1 : 0);
  }
  if (filters.startDate) {
    conditions.push('created_at >= ?');
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    conditions.push('created_at <= ?');
    params.push(filters.endDate + ' 23:59:59');
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return db.prepare(`SELECT * FROM notifications ${where} ORDER BY created_at DESC, id DESC`).all(...params) as Notification[];
}

export function markNotificationRead(db: Database.Database, id: number): void {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
}

export function markAllRead(db: Database.Database): void {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE is_read = 0').run();
}

export function getNotificationPreferences(db: Database.Database): (NotificationPreference & { forced: boolean })[] {
  const stored = db.prepare('SELECT * FROM notification_preferences').all() as NotificationPreference[];
  const storedMap = new Map(stored.map(p => [p.notification_type, p]));

  const allTypes = Object.keys(DEFAULT_PREFERENCES) as NotificationType[];
  return allTypes.map(type => {
    const existing = storedMap.get(type);
    const forced = FORCED_IMMEDIATE.includes(type);
    return {
      id: existing?.id ?? 0,
      notification_type: type,
      email_delivery: forced ? 'immediate' : (existing?.email_delivery ?? DEFAULT_PREFERENCES[type]),
      forced,
    };
  });
}

export function upsertPreference(db: Database.Database, type: NotificationType, delivery: EmailDelivery): void {
  db.prepare(`
    INSERT INTO notification_preferences (notification_type, email_delivery)
    VALUES (?, ?)
    ON CONFLICT(notification_type) DO UPDATE SET email_delivery = excluded.email_delivery
  `).run(type, delivery);
}

export function getEmailDeliveryForType(db: Database.Database, type: NotificationType): EmailDelivery {
  if (FORCED_IMMEDIATE.includes(type)) return 'immediate';
  const row = db.prepare('SELECT email_delivery FROM notification_preferences WHERE notification_type = ?').get(type) as any;
  return row?.email_delivery ?? DEFAULT_PREFERENCES[type];
}

export function getDigestNotifications(db: Database.Database): Notification[] {
  const digestTypes = Object.entries(DEFAULT_PREFERENCES)
    .filter(([type]) => !FORCED_IMMEDIATE.includes(type as NotificationType))
    .map(([type]) => type);

  const prefs = db.prepare('SELECT notification_type, email_delivery FROM notification_preferences').all() as NotificationPreference[];
  const prefMap = new Map(prefs.map(p => [p.notification_type, p.email_delivery]));

  const includeTypes = digestTypes.filter(type => {
    const delivery = prefMap.get(type as NotificationType) ?? DEFAULT_PREFERENCES[type as NotificationType];
    return delivery === 'digest';
  });

  if (includeTypes.length === 0) return [];

  const placeholders = includeTypes.map(() => '?').join(',');
  return db.prepare(`
    SELECT * FROM notifications
    WHERE type IN (${placeholders})
      AND is_read = 0
      AND created_at >= datetime('now', '-24 hours')
    ORDER BY created_at DESC
  `).all(...includeTypes) as Notification[];
}
