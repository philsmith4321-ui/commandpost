import Link from 'next/link';
import { getDb } from '@/lib/db';
import { listInvoices, getInvoiceSummary } from '@/lib/queries/invoice-queries';
import { listExpenses, getExpenseMonthlyTotal } from '@/lib/queries/expense-queries';
import { getMonthlyRevenue, getProfitabilityByClient, getYtdStats, getRevenueByClient } from '@/lib/queries/finance-queries';
import { listClients } from '@/lib/queries/client-queries';
import { deleteExpenseAction } from '@/lib/actions/expense-actions';
import { getRecurringInvoices, getMrr } from '@/lib/queries/invoice-queries';
import { toggleRecurringAction } from '@/lib/actions/invoice-actions';
import { FinanceTabs } from '@/components/finance-tabs';
import { ExpenseForm } from '@/components/expense-form';
import { RevenueChart } from '@/components/revenue-chart';
import { StatusBadge } from '@/components/status-badge';

export const dynamic = 'force-dynamic';

export default async function FinancesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; category?: string; month?: string; period?: string }>;
}) {
  const { tab = 'invoices', category, month, period } = await searchParams;
  const db = getDb();

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Finances</h2>
        {tab === 'invoices' && (
          <Link href="/finances/invoices/new"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
            + New Invoice
          </Link>
        )}
      </div>

      <FinanceTabs active={tab} />

      {tab === 'invoices' && <InvoicesTab />}
      {tab === 'expenses' && <ExpensesTab category={category} month={month} />}
      {tab === 'revenue' && <RevenueTab />}
      {tab === 'profitability' && <ProfitabilityTab period={period} />}
      {tab === 'recurring' && <RecurringTab />}
    </div>
  );
}

function InvoicesTab() {
  const db = getDb();
  const invoices = listInvoices(db);
  const summary = getInvoiceSummary(db);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Outstanding</p>
          <p className="text-2xl font-bold text-white">${summary.totalOutstanding.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Overdue</p>
          <p className={`text-2xl font-bold ${summary.overdueCount > 0 ? 'text-red-400' : 'text-white'}`}>
            ${summary.totalOverdue.toLocaleString()}
          </p>
          {summary.overdueCount > 0 && <p className="text-xs text-red-400">{summary.overdueCount} invoice{summary.overdueCount > 1 ? 's' : ''}</p>}
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Paid This Month</p>
          <p className="text-2xl font-bold text-green-400">${summary.paidThisMonth.toLocaleString()}</p>
        </div>
      </div>

      {invoices.length === 0 ? (
        <p className="text-sm text-gray-500">No invoices yet. Create your first invoice to get started.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-500">
                <th className="pb-3 font-medium">Invoice</th>
                <th className="pb-3 font-medium">Client</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium text-right">Amount</th>
                <th className="pb-3 font-medium">Due Date</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                  <td className="py-3">
                    <Link href={`/finances/invoices/${inv.id}`} className="text-blue-400 hover:text-blue-300">
                      {inv.invoice_number}
                    </Link>
                  </td>
                  <td className="py-3 text-white">{inv.client_name}</td>
                  <td className="py-3">
                    <StatusBadge status={inv.is_overdue ? 'overdue' : inv.status} />
                  </td>
                  <td className="py-3 text-right text-white">${inv.total_amount.toLocaleString()}</td>
                  <td className={`py-3 ${inv.is_overdue ? 'text-red-400' : 'text-gray-400'}`}>{inv.due_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function ExpensesTab({ category, month }: { category?: string; month?: string }) {
  const db = getDb();
  const expenses = listExpenses(db, {
    category: category as any,
    month,
  });
  const clients = listClients(db).map(c => ({ id: c.id, name: c.name }));
  const currentMonth = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const monthlyTotal = getExpenseMonthlyTotal(db, currentMonth);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">
          Monthly total ({currentMonth}): <span className="text-white font-medium">${monthlyTotal.toLocaleString()}</span>
        </p>
      </div>

      <ExpenseForm clients={clients} />

      {expenses.length === 0 ? (
        <p className="text-sm text-gray-500">No expenses recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-500">
                <th className="pb-3 font-medium">Date</th>
                <th className="pb-3 font-medium">Description</th>
                <th className="pb-3 font-medium">Category</th>
                <th className="pb-3 font-medium text-right">Amount</th>
                <th className="pb-3 font-medium">Client</th>
                <th className="pb-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp) => (
                <tr key={exp.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                  <td className="py-3 text-gray-400">{exp.expense_date}</td>
                  <td className="py-3 text-white">{exp.description}</td>
                  <td className="py-3"><StatusBadge status={exp.category} /></td>
                  <td className="py-3 text-right text-white">${exp.amount.toLocaleString()}</td>
                  <td className="py-3 text-gray-400">{exp.client_name || '—'}</td>
                  <td className="py-3">
                    <form action={deleteExpenseAction}>
                      <input type="hidden" name="id" value={exp.id} />
                      <button type="submit" className="text-xs text-red-400 hover:text-red-300">
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function RevenueTab() {
  const db = getDb();
  const monthlyRevenue = getMonthlyRevenue(db);
  const ytd = getYtdStats(db);
  const topClients = getRevenueByClient(db);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">YTD Revenue</p>
          <p className="text-2xl font-bold text-green-400">${ytd.revenue.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">YTD Expenses</p>
          <p className="text-2xl font-bold text-red-400">${ytd.expenses.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">YTD Profit</p>
          <p className={`text-2xl font-bold ${ytd.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ${ytd.profit.toLocaleString()}
          </p>
        </div>
      </div>

      <RevenueChart data={monthlyRevenue} />

      {topClients.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Top Clients by Revenue</h3>
          <div className="space-y-2">
            {topClients.map((c) => (
              <div key={c.client_id} className="flex items-center justify-between p-3 bg-gray-900 border border-gray-800 rounded-lg">
                <span className="text-sm text-white">{c.client_name}</span>
                <span className="text-sm text-green-400">${c.total.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function ProfitabilityTab({ period }: { period?: string }) {
  const db = getDb();
  const profitability = getProfitabilityByClient(db, period || 'all');

  const periods = [
    { key: 'this_month', label: 'This Month' },
    { key: 'last_3_months', label: 'Last 3 Months' },
    { key: 'ytd', label: 'YTD' },
    { key: 'all', label: 'All Time' },
  ];

  return (
    <>
      <div className="flex gap-2 mb-6">
        {periods.map((p) => (
          <Link key={p.key} href={`/finances?tab=profitability&period=${p.key}`}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              (period || 'all') === p.key ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}>
            {p.label}
          </Link>
        ))}
      </div>

      {profitability.length === 0 ? (
        <p className="text-sm text-gray-500">No financial data for this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-500">
                <th className="pb-3 font-medium">Client</th>
                <th className="pb-3 font-medium text-right">Revenue</th>
                <th className="pb-3 font-medium text-right">Expenses</th>
                <th className="pb-3 font-medium text-right">Profit</th>
                <th className="pb-3 font-medium text-right">Margin</th>
              </tr>
            </thead>
            <tbody>
              {profitability.map((row) => (
                <tr key={row.client_id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                  <td className="py-3 text-white">{row.client_name}</td>
                  <td className="py-3 text-right text-green-400">${row.revenue.toLocaleString()}</td>
                  <td className="py-3 text-right text-red-400">${row.expenses.toLocaleString()}</td>
                  <td className={`py-3 text-right font-medium ${row.profit >= 0 ? 'text-white' : 'text-red-400'}`}>
                    ${row.profit.toLocaleString()}
                  </td>
                  <td className="py-3 text-right text-gray-400">
                    {row.margin !== null ? `${row.margin}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function RecurringTab() {
  const db = getDb();
  const recurring = getRecurringInvoices(db);
  const mrr = getMrr(db);
  const activeCount = recurring.length;

  // Next generation date: earliest recurrence_day in the future
  const today = new Date().getDate();
  const futureDays = recurring.map(r => r.recurrence_day).filter(d => d > today);
  const nextDay = futureDays.length > 0 ? Math.min(...futureDays) : (recurring.length > 0 ? Math.min(...recurring.map(r => r.recurrence_day)) : null);
  const now = new Date();
  let nextDate: string | null = null;
  if (nextDay !== null) {
    let m = now.getMonth();
    let y = now.getFullYear();
    if (nextDay <= today) { m += 1; if (m > 11) { m = 0; y += 1; } }
    nextDate = `${y}-${String(m + 1).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">MRR</p>
          <p className="text-2xl font-bold text-green-400">${mrr.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Active Recurring</p>
          <p className="text-2xl font-bold text-white">{activeCount}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Next Generation</p>
          <p className="text-sm font-medium text-white">{nextDate || '—'}</p>
        </div>
      </div>

      {recurring.length === 0 ? (
        <p className="text-sm text-gray-500">No recurring invoices set up. Mark an invoice as recurring from its detail page, or set one up from a client page.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-500">
                <th className="pb-3 font-medium">Invoice</th>
                <th className="pb-3 font-medium">Client</th>
                <th className="pb-3 font-medium text-right">Amount</th>
                <th className="pb-3 font-medium">Day</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {recurring.map((inv) => (
                <tr key={inv.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                  <td className="py-3">
                    <Link href={`/finances/invoices/${inv.id}`} className="text-blue-400 hover:text-blue-300">
                      {inv.invoice_number}
                    </Link>
                  </td>
                  <td className="py-3 text-white">{inv.client_name}</td>
                  <td className="py-3 text-right text-white">${inv.total_amount.toLocaleString()}</td>
                  <td className="py-3 text-gray-400">{inv.recurrence_day}</td>
                  <td className="py-3"><StatusBadge status={inv.status} /></td>
                  <td className="py-3">
                    <form action={toggleRecurringAction}>
                      <input type="hidden" name="id" value={inv.id} />
                      <button type="submit" className="text-xs text-red-400 hover:text-red-300">
                        Deactivate
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
