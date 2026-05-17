import Link from 'next/link';

const TABS = [
  { key: 'invoices', label: 'Invoices' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'profitability', label: 'Profitability' },
  { key: 'recurring', label: 'Recurring' },
  { key: 'time', label: 'Time' },
  { key: 'subscriptions', label: 'Subscriptions' },
];

export function FinanceTabs({ active }: { active: string }) {
  return (
    <div className="flex gap-1 mb-6 border-b border-gray-800 pb-1">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.key === 'invoices' ? '/finances' : tab.key === 'time' ? '/finances/time' : tab.key === 'expenses' ? '/finances/expenses' : tab.key === 'overdue' ? '/finances/overdue' : tab.key === 'subscriptions' ? '/finances/subscriptions' : `/finances?tab=${tab.key}`}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            active === tab.key
              ? 'bg-gray-800 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
