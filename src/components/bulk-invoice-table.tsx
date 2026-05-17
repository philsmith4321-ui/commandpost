'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { bulkInvoiceAction } from '@/lib/actions/invoice-actions';

interface Invoice {
  id: number;
  invoice_number: string;
  client_name: string;
  status: string;
  total_amount: number;
  due_date: string;
  is_overdue: boolean;
}

export function BulkInvoiceTable({ invoices }: { invoices: Invoice[] }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const toggleAll = () => {
    if (selected.size === invoices.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(invoices.map(i => i.id)));
    }
  };

  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleBulkAction = (action: string) => {
    if (selected.size === 0) return;
    if (action === 'delete' && !confirm(`Delete ${selected.size} invoice(s)?`)) return;

    const fd = new FormData();
    fd.set('ids', Array.from(selected).join(','));
    fd.set('action', action);
    startTransition(async () => {
      await bulkInvoiceAction(fd);
      setSelected(new Set());
      router.refresh();
    });
  };

  const statusColor = (status: string, isOverdue: boolean) => {
    if (isOverdue) return 'bg-red-900/50 text-red-400';
    if (status === 'paid') return 'bg-green-900/50 text-green-400';
    if (status === 'sent') return 'bg-blue-900/50 text-blue-400';
    return 'bg-gray-800 text-gray-400';
  };

  return (
    <div>
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-blue-900/20 border border-blue-800 rounded-lg">
          <span className="text-sm text-blue-400">{selected.size} selected</span>
          <button onClick={() => handleBulkAction('mark_sent')} disabled={isPending}
            className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50">
            Mark Sent
          </button>
          <button onClick={() => handleBulkAction('mark_paid')} disabled={isPending}
            className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50">
            Mark Paid
          </button>
          <button onClick={() => handleBulkAction('delete')} disabled={isPending}
            className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50">
            Delete
          </button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-gray-400 hover:text-white">
            Clear
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left text-gray-500">
              <th className="pb-3 pr-2">
                <input type="checkbox" checked={selected.size === invoices.length && invoices.length > 0}
                  onChange={toggleAll} className="rounded bg-gray-800 border-gray-600" />
              </th>
              <th className="pb-3 font-medium">Invoice</th>
              <th className="pb-3 font-medium">Client</th>
              <th className="pb-3 font-medium">Status</th>
              <th className="pb-3 font-medium text-right">Amount</th>
              <th className="pb-3 font-medium">Due Date</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className={`border-b border-gray-800/50 hover:bg-gray-900/50 ${selected.has(inv.id) ? 'bg-blue-900/10' : ''}`}>
                <td className="py-3 pr-2">
                  <input type="checkbox" checked={selected.has(inv.id)} onChange={() => toggle(inv.id)}
                    className="rounded bg-gray-800 border-gray-600" />
                </td>
                <td className="py-3">
                  <Link href={`/finances/invoices/${inv.id}`} className="text-blue-400 hover:text-blue-300">
                    {inv.invoice_number}
                  </Link>
                </td>
                <td className="py-3 text-white">{inv.client_name}</td>
                <td className="py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(inv.status, inv.is_overdue)}`}>
                    {inv.is_overdue ? 'overdue' : inv.status}
                  </span>
                </td>
                <td className="py-3 text-right text-white">${inv.total_amount.toLocaleString()}</td>
                <td className={`py-3 ${inv.is_overdue ? 'text-red-400' : 'text-gray-400'}`}>{inv.due_date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
