import type { TimeEntry, Deliverable } from '@/lib/types';
import { deleteTimeEntryAction } from '@/lib/actions/time-actions';

interface TimeEntriesTableProps {
  entries: TimeEntry[];
  deliverables: Deliverable[];
  clientId: number;
  projectId: number;
}

export function TimeEntriesTable({ entries, deliverables, clientId, projectId }: TimeEntriesTableProps) {
  const deliverableMap = Object.fromEntries(deliverables.map(d => [d.id, d.title]));

  if (entries.length === 0) {
    return <p className="text-gray-500 text-sm">No time entries yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-gray-400 text-left">
            <th className="pb-2 pr-4">Date</th>
            <th className="pb-2 pr-4">Deliverable</th>
            <th className="pb-2 pr-4">Description</th>
            <th className="pb-2 pr-4 text-right">Duration</th>
            <th className="pb-2 pr-4 text-right">Rate</th>
            <th className="pb-2 pr-4 text-right">Amount</th>
            <th className="pb-2 pr-4">Status</th>
            <th className="pb-2"></th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const hours = entry.duration_minutes / 60;
            const amount = hours * entry.hourly_rate;
            return (
              <tr key={entry.id} className="border-b border-gray-800/50">
                <td className="py-2 pr-4 text-white">{entry.entry_date}</td>
                <td className="py-2 pr-4 text-gray-300">
                  {entry.deliverable_id ? deliverableMap[entry.deliverable_id] || '—' : '—'}
                </td>
                <td className="py-2 pr-4 text-gray-300">{entry.description || '—'}</td>
                <td className="py-2 pr-4 text-right text-white">{hours.toFixed(2)}h</td>
                <td className="py-2 pr-4 text-right text-gray-300">${entry.hourly_rate}</td>
                <td className="py-2 pr-4 text-right text-white">${amount.toFixed(2)}</td>
                <td className="py-2 pr-4">
                  <span className={`text-xs px-2 py-0.5 rounded ${entry.is_invoiced ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'}`}>
                    {entry.is_invoiced ? 'Invoiced' : 'Uninvoiced'}
                  </span>
                </td>
                <td className="py-2">
                  {!entry.is_invoiced && (
                    <form action={deleteTimeEntryAction} className="inline">
                      <input type="hidden" name="id" value={entry.id} />
                      <input type="hidden" name="client_id" value={clientId} />
                      <input type="hidden" name="project_id" value={projectId} />
                      <button type="submit" className="text-gray-600 hover:text-red-400 transition-colors" title="Delete">
                        x
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
