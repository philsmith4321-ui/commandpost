'use client';

import { useState } from 'react';
import Link from 'next/link';
import { markNotificationReadAction, markAllNotificationsReadAction } from '@/lib/actions/notification-actions';
import type { Notification } from '@/lib/types';

interface NotificationBellProps {
  unreadCount: number;
  recentNotifications: Notification[];
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr + 'Z').getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function NotificationBell({ unreadCount, recentNotifications }: NotificationBellProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800"
        title="Notifications"
      >
        <span className="text-base">&#9883;</span>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50">
          <div className="flex items-center justify-between p-3 border-b border-gray-800">
            <span className="text-sm font-medium text-white">Notifications</span>
            {unreadCount > 0 && (
              <form action={markAllNotificationsReadAction}>
                <button type="submit" className="text-xs text-blue-400 hover:text-blue-300">
                  Mark all read
                </button>
              </form>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {recentNotifications.length === 0 ? (
              <p className="p-4 text-sm text-gray-500 text-center">No notifications</p>
            ) : (
              recentNotifications.map((n) => (
                <div key={n.id} className="flex items-start gap-3 p-3 border-b border-gray-800/50 hover:bg-gray-800/50">
                  {!n.is_read && <span className="w-2 h-2 mt-1.5 rounded-full bg-blue-400 shrink-0" />}
                  {!!n.is_read && <span className="w-2 h-2 mt-1.5 rounded-full bg-transparent shrink-0" />}
                  <div className="flex-1 min-w-0">
                    {n.link ? (
                      <Link href={n.link} onClick={() => setOpen(false)} className="text-sm text-white hover:text-blue-400 block truncate">
                        {n.title}
                      </Link>
                    ) : (
                      <p className="text-sm text-white truncate">{n.title}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-0.5">{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-2 border-t border-gray-800">
            <Link
              href="/notifications"
              className="block text-center text-xs text-blue-400 hover:text-blue-300 py-1"
              onClick={() => setOpen(false)}
            >
              View all
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
