import { getDb } from '@/lib/db';
import { getUnreadCount, getRecentNotifications } from '@/lib/queries/notification-queries';
import { NotificationBell } from '@/components/notification-bell';

export function NotificationBellServer() {
  const db = getDb();
  const unreadCount = getUnreadCount(db);
  const recentNotifications = getRecentNotifications(db, 10);
  return <NotificationBell unreadCount={unreadCount} recentNotifications={recentNotifications} />;
}
