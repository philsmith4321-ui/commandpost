'use client';

import { useState } from 'react';

interface TimeEntryRow {
  id: number;
  entry_date: string;
  client_name: string;
  project_name: string;
  deliverable_title: string | null;
  duration_minutes: number;
  hourly_rate: number;
  is_invoiced: number;
  description: string | null;
}

export function BulkTimeTable({ entries, clientId }: { entries: TimeEntryRow[]; clientId?: string }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const uninvoiced = entries.filter(e => !e.is_invoiced);

  function toggleAll() {
    if (selected.size === uninvoiced.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(uninvoiced.map(e => e.id)));
    }
  }

  function toggle(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  const selectedTotal = entries
    .filter(e => selected.has(e.id))
    .reduce((sum, e) => sum + (e.duration_minutes / 60) * e.hourly_rate, 0);

  return (
    <div>
      {entries.length === 0 ? (
        <p className="text-gray-500 text-sm">No time entries found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-left">
                <th className="pb-2 pr-2">
                  {uninvoiced.length > 0 && (
                    <input
                      type="checkbox"
                      checked={selected.size === uninvoiced.length && uninvoiced.length > 0}
                      onChange={toggleAll}
                      className="rounded"
                    />
                  )}
                </th>
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Client</th>
                <th className="pb-2 pr-4">Project</th>
                <th className="pb-2 pr-4">Description</th>
                <th className="pb-2 pr-4 text-right">Duration</th>
                <th className="pb-2 pr-4 text-right">Rate</th>
                <th className="pb-2 pr-4 text-right">Amount</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const hours = entry.duration_minutes / 60;
                const amount = hours * entry.hourly_rate;
                return (
                  <tr key={entry.id} className={`border-b border-gray-800/50 ${selected.has(entry.id) ? 'bg-blue-900/10' : ''}`}>
                    <td className="py-2 pr-2">
                      {!entry.is_invoiced && (
                        <input
                          type="checkbox"
                          checked={selected.has(entry.id)}
                          onChange={() => toggle(entry.id)}
                          className="rounded"
                        />
                      )}
                    </td>
                    <td className="py-2 pr-4 text-white">{entry.entry_date}</td>
                    <td className="py-2 pr-4 text-gray-300">{entry.client_name}</td>
                    <td className="py-2 pr-4 text-gray-300">{entry.project_name}</td>
                    <td className="py-2 pr-4 text-gray-400 max-w-32 truncate">{entry.description || '—'}</td>
                    <td className="py-2 pr-4 text-right text-white">{hours.toFixed(2)}h</td>
                    <td className="py-2 pr-4 text-right text-gray-300">${entry.hourly_rate}</td>
                    <td className="py-2 pr-4 text-right text-white">${amount.toFixed(2)}</td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${entry.is_invoiced ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'}`}>
                        {entry.is_invoiced ? 'Invoiced' : 'Uninvoiced'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected.size > 0 && (
        <div className="mt-4 p-4 bg-gray-900 border border-gray-800 rounded-lg flex items-center justify-between">
          <div>
            <p className="text-sm text-white">{selected.size} entries selected</p>
            <p className="text-xs text-gray-400">Total: ${selectedTotal.toFixed(2)}</p>
          </div>
          <form action="/api/invoices/from-time" method="POST">
            <input type="hidden" name="entry_ids" value={JSON.stringify(Array.from(selected))} />
            {clientId && <input type="hidden" name="client_id" value={clientId} />}
            <button type="submit" className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors">
              Generate Invoice from Selected
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
