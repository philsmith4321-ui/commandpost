'use client';

import { useState } from 'react';

interface Item {
  description: string;
  quantity: string;
  unit_price: string;
}

export function ProposalItemsForm() {
  const [items, setItems] = useState<Item[]>([{ description: '', quantity: '1', unit_price: '' }]);

  function addItem() {
    setItems([...items, { description: '', quantity: '1', unit_price: '' }]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof Item, value: string) {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  }

  const total = items.reduce((sum, item) => {
    return sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
  }, 0);

  return (
    <div>
      <label className="block text-sm text-gray-400 mb-2">Line Items</label>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="text"
              name="item_description"
              value={item.description}
              onChange={(e) => updateItem(i, 'description', e.target.value)}
              placeholder="Description"
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
            />
            <input
              type="number"
              name="item_quantity"
              value={item.quantity}
              onChange={(e) => updateItem(i, 'quantity', e.target.value)}
              placeholder="Qty"
              step="0.01"
              className="w-20 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
            />
            <input
              type="number"
              name="item_unit_price"
              value={item.unit_price}
              onChange={(e) => updateItem(i, 'unit_price', e.target.value)}
              placeholder="Rate"
              step="0.01"
              className="w-24 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
            />
            <span className="w-24 px-3 py-2 text-white text-sm text-right">
              ${((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)).toLocaleString()}
            </span>
            {items.length > 1 && (
              <button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-300 px-2">×</button>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-3">
        <button type="button" onClick={addItem} className="text-sm text-blue-400 hover:text-blue-300">+ Add Item</button>
        <span className="text-white font-medium">Total: ${total.toLocaleString()}</span>
      </div>
    </div>
  );
}
