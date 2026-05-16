'use client';

import { useState } from 'react';
import { createRecurringInvoiceAction } from '@/lib/actions/invoice-actions';

interface LineItem {
  description: string;
  quantity: string;
  unit_price: string;
}

export function RecurringInvoiceForm({ clientId }: { clientId: number }) {
  const [items, setItems] = useState<LineItem[]>([{ description: '', quantity: '1', unit_price: '' }]);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
        + Set Up Recurring Invoice
      </button>
    );
  }

  return (
    <form action={createRecurringInvoiceAction} className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
      <h4 className="text-sm font-medium text-white mb-3">New Recurring Invoice</h4>
      <input type="hidden" name="client_id" value={clientId} />

      <div className="mb-4">
        <label className="block text-xs text-gray-500 uppercase mb-1">Recurrence Day (1-28)</label>
        <input type="number" name="recurrence_day" min={1} max={28} defaultValue={1} required
          className="w-24 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
      </div>

      <div className="space-y-2 mb-4">
        <p className="text-xs text-gray-500 uppercase">Line Items</p>
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input type="text" name="item_description" placeholder="Description" required value={item.description}
              onChange={e => { const n = [...items]; n[i].description = e.target.value; setItems(n); }}
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
            <input type="number" name="item_quantity" placeholder="Qty" min={1} value={item.quantity}
              onChange={e => { const n = [...items]; n[i].quantity = e.target.value; setItems(n); }}
              className="w-16 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
            <input type="number" name="item_unit_price" placeholder="Price" step="0.01" min={0} required value={item.unit_price}
              onChange={e => { const n = [...items]; n[i].unit_price = e.target.value; setItems(n); }}
              className="w-24 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
            {items.length > 1 && (
              <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))}
                className="text-red-400 hover:text-red-300 text-sm px-2">Remove</button>
            )}
          </div>
        ))}
        <button type="button" onClick={() => setItems([...items, { description: '', quantity: '1', unit_price: '' }])}
          className="text-xs text-blue-400 hover:text-blue-300">+ Add line item</button>
      </div>

      <div className="flex gap-2">
        <button type="submit"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
          Create
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}
