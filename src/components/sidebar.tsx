'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAction } from '@/lib/actions/auth-actions';

const navItems = [
  { href: '/', label: 'Dashboard', icon: '▣' },
  { href: '/generate', label: 'Generate', icon: '✦' },
  { href: '/content', label: 'Radio/Video', icon: '✂' },
  { href: '/social', label: 'Social', icon: '◮' },
  { href: '/ingestion', label: 'Ingestion', icon: '⬇' },
  { href: '/clients', label: 'Clients', icon: '◉' },
  { href: '/projects', label: 'Projects', icon: '◧' },
  { href: '/pipeline', label: 'Pipeline', icon: '◈' },
  { href: '/outreach', label: 'Outreach', icon: '🎯' },
  { href: '/outreach/email-queue', label: 'Email Queue', icon: '✉' },
  { href: '/proposals', label: 'Proposals', icon: '▤' },
  { href: '/contracts', label: 'Contracts', icon: '⊜' },
  { href: '/finances', label: 'Finances', icon: '◇' },
  { href: '/reports', label: 'Reports', icon: '◫' },
  { href: '/board', label: 'Board', icon: '⊟' },
  { href: '/templates', label: 'Templates', icon: '⊞' },
  { href: '/meetings', label: 'Meetings', icon: '◎' },
  { href: '/calendar', label: 'Calendar', icon: '⊘' },
  { href: '/automations', label: 'Automations', icon: '⚡' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-56 bg-gray-900 border-r border-gray-800 min-h-screen">
      <div className="p-5 border-b border-gray-800">
        <h1 className="text-lg font-bold text-white">CommandPost</h1>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-gray-800">
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg text-left transition-colors"
          >
            Sign Out
          </button>
        </form>
      </div>
    </aside>
  );
}
