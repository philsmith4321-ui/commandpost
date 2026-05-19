'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const primaryItems = [
  { href: '/', label: 'Home', icon: '▣' },
  { href: '/clients', label: 'Clients', icon: '◉' },
  { href: '/pipeline', label: 'Pipeline', icon: '◈' },
  { href: '/finances', label: 'Finances', icon: '◇' },
];

const moreItems = [
  { href: '/projects', label: 'Projects', icon: '◧' },
  { href: '/proposals', label: 'Proposals', icon: '▤' },
  { href: '/contracts', label: 'Contracts', icon: '⊜' },
  { href: '/ops', label: 'Ops', icon: '◆' },
  { href: '/reports', label: 'Reports', icon: '◫' },
  { href: '/board', label: 'Board', icon: '⊟' },
  { href: '/meetings', label: 'Meetings', icon: '◎' },
  { href: '/calendar', label: 'Calendar', icon: '⊘' },
  { href: '/templates', label: 'Templates', icon: '⊞' },
  { href: '/automations', label: 'Automations', icon: '⚡' },
  { href: '/contacts', label: 'Contacts', icon: '◉' },
  { href: '/emails', label: 'Email Log', icon: '✉' },
  { href: '/digest', label: 'Digest', icon: '◫' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
];

export function MobileNav() {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);

  return (
    <>
      {/* More menu overlay */}
      {showMore && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setShowMore(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="absolute bottom-14 left-0 right-0 bg-gray-900 border-t border-gray-800 max-h-[60vh] overflow-y-auto rounded-t-xl">
            <div className="grid grid-cols-3 gap-1 p-3">
              {moreItems.map(item => {
                const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                return (
                  <Link key={item.href} href={item.href} onClick={() => setShowMore(false)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg text-xs ${isActive ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-800'}`}>
                    <span className="text-lg">{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 z-50">
        <div className="flex justify-around py-2">
          {primaryItems.map((item) => {
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 text-xs ${isActive ? 'text-blue-400' : 'text-gray-500'}`}>
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
          <button onClick={() => setShowMore(!showMore)}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 text-xs ${showMore ? 'text-blue-400' : 'text-gray-500'}`}>
            <span className="text-lg">☰</span>
            More
          </button>
        </div>
      </nav>
    </>
  );
}
