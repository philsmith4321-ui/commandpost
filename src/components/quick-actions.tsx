import Link from 'next/link';

const actions = [
  { href: '/finances/time', label: 'Log Time', icon: '⏱' },
  { href: '/finances/invoices/new', label: 'New Invoice', icon: '◇' },
  { href: '/pipeline/new', label: 'New Lead', icon: '◈' },
  { href: '/proposals/new', label: 'New Proposal', icon: '▤' },
  { href: '/clients', label: 'Add Client', icon: '◉' },
];

export function QuickActions() {
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {actions.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-white transition-colors"
        >
          <span>{action.icon}</span>
          {action.label}
        </Link>
      ))}
    </div>
  );
}
