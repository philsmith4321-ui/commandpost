'use client';

import { useState } from 'react';

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
}

interface InvoiceLineItemsProps {
  initialItems?: LineItem[];
}

export function InvoiceLineItems({ initialItems }: InvoiceLineItemsProps) {
  const [items, setItems] = useState<LineItem[]>(
    initialItems?.length ? initialItems : [{ description: '', quantity: 1, unit_price: 0 }]
  );

  function addItem() {
    setItems([...items, { description: '', quantity: 1, unit_price: 0 }]);
  }

  function removeItem(index: number) {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof LineItem, value: string | number) {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  }

  const total = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  return (
    <div>
      <label className="block text-sm text-gray-400 mb-2">Line Items</label>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2 items-start">
            <input type="text" name="item_description" value={item.description} required
              onChange={(e) => updateItem(i, 'description', e.target.value)}
              placeholder="Description"
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
            <input type="number" name="item_quantity" value={item.quantity} min="0.01" step="0.01"
              onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))}
              className="w-20 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white text-right focus:outline-none focus:border-blue-500" />
            <input type="number" name="item_unit_price" value={item.unit_price} min="0" step="0.01"
              onChange={(e) => updateItem(i, 'unit_price', Number(e.target.value))}
              placeholder="Price"
              className="w-28 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white text-right focus:outline-none focus:border-blue-500" />
            <span className="w-24 px-3 py-2 text-sm text-gray-400 text-right">
              ${(item.quantity * item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <button type="button" onClick={() => removeItem(i)}
              className="px-2 py-2 text-red-400 hover:text-red-300 text-sm" title="Remove">
              &times;
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-3">
        <button type="button" onClick={addItem}
          className="text-sm text-blue-400 hover:text-blue-300">
          + Add Line Item
        </button>
        <p className="text-sm font-medium text-white">
          Total: ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </p>
      </div>
    </div>
  );
}
