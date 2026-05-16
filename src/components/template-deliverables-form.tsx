'use client';

import { useState } from 'react';

export function TemplateDeliverablesForm() {
  const [rows, setRows] = useState([{ title: '', days: 0 }]);

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2">
          <input
            type="text"
            name={`deliverable_title_${i}`}
            value={row.title}
            onChange={(e) => {
              const updated = [...rows];
              updated[i].title = e.target.value;
              setRows(updated);
            }}
            placeholder="Deliverable title"
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
          />
          <input
            type="number"
            name={`deliverable_days_${i}`}
            value={row.days}
            onChange={(e) => {
              const updated = [...rows];
              updated[i].days = Number(e.target.value);
              setRows(updated);
            }}
            className="w-20 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
            placeholder="Days"
          />
          {rows.length > 1 && (
            <button
              type="button"
              onClick={() => setRows(rows.filter((_, j) => j !== i))}
              className="px-2 text-red-400 hover:text-red-300 text-sm"
            >
              Remove
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows([...rows, { title: '', days: 0 }])}
        className="text-sm text-blue-400 hover:text-blue-300"
      >
        + Add deliverable
      </button>
    </div>
  );
}
