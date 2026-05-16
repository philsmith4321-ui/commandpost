'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAction } from '@/lib/actions/auth-actions';

const navItems = [
  { href: '/', label: 'Dashboard', icon: '▣' },
  { href: '/clients', label: 'Clients', icon: '◉' },
  { href: '/pipeline', label: 'Pipeline', icon: '◈' },
  { href: '/proposals', label: 'Proposals', icon: '▤' },
  { href: '/finances', label: 'Finances', icon: '◇' },
  { href: '/ops', label: 'Ops', icon: '◆' },
  { href: '/reports', label: 'Reports', icon: '◫' },
  { href: '/templates', label: 'Templates', icon: '⊞' },
  { href: '/notifications', label: 'Notifications', icon: '⊛' },
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
