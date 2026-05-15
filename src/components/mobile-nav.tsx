'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Home', icon: '▣' },
  { href: '/clients', label: 'Clients', icon: '◉' },
  { href: '/pipeline', label: 'Pipeline', icon: '◈' },
  { href: '/finances', label: 'Finances', icon: '◇' },
  { href: '/ops', label: 'Ops', icon: '◆' },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 z-50">
      <div className="flex justify-around py-2">
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 text-xs ${
                isActive ? 'text-blue-400' : 'text-gray-500'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
