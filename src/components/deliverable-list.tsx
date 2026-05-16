'use client';

import { useRef } from 'react';
import type { Deliverable, DeliverableStatus } from '@/lib/types';
import { addDeliverableAction, updateDeliverableStatusAction, deleteDeliverableAction } from '@/lib/actions/deliverable-actions';

interface DeliverableListProps {
  clientId: number;
  projectId: number;
  deliverables: Deliverable[];
  deliverableHours?: Record<number, number>;
}

const statusCycle: Record<DeliverableStatus, DeliverableStatus> = {
  not_started: 'in_progress',
  in_progress: 'delivered',
  delivered: 'not_started',
};

const statusIcons: Record<DeliverableStatus, string> = {
  not_started: '\u25CB',  // open circle
  in_progress: '\u25D0',  // half circle
  delivered: '\u25CF',     // filled circle
};

const statusColors: Record<DeliverableStatus, string> = {
  not_started: 'text-gray-400',
  in_progress: 'text-blue-400',
  delivered: 'text-green-400',
};

function isOverdue(dueDate: string | null, status: DeliverableStatus): boolean {
  if (!dueDate || status === 'delivered') return false;
  return new Date(dueDate) < new Date();
}

function isDueSoon(dueDate: string | null, status: DeliverableStatus): boolean {
  if (!dueDate || status === 'delivered') return false;
  const due = new Date(dueDate);
  const now = new Date();
  const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  return due >= now && due <= threeDays;
}

export function DeliverableList({ clientId, projectId, deliverables, deliverableHours }: DeliverableListProps) {
  const formRef = useRef<HTMLFormElement>(null);

  async function handleAdd(formData: FormData) {
    await addDeliverableAction(formData);
    formRef.current?.reset();
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-white mb-4">Deliverables</h3>

      {deliverables.length === 0 ? (
        <p className="text-gray-500 text-sm mb-4">No deliverables yet.</p>
      ) : (
        <div className="space-y-2 mb-4">
          {deliverables.map((d) => {
            const overdue = isOverdue(d.due_date, d.status);
            const dueSoon = isDueSoon(d.due_date, d.status);
            const nextStatus = statusCycle[d.status];

            let borderClass = 'border-gray-800';
            let bgClass = 'bg-gray-900';
            if (overdue) {
              borderClass = 'border-red-700';
              bgClass = 'bg-red-950/30';
            } else if (dueSoon) {
              borderClass = 'border-yellow-700';
              bgClass = 'bg-yellow-950/30';
            }

            return (
              <div
                key={d.id}
                className={`flex items-center gap-3 p-3 ${bgClass} border ${borderClass} rounded-lg`}
              >
                <form action={updateDeliverableStatusAction}>
                  <input type="hidden" name="id" value={d.id} />
                  <input type="hidden" name="status" value={nextStatus} />
                  <input type="hidden" name="client_id" value={clientId} />
                  <input type="hidden" name="project_id" value={projectId} />
                  <button
                    type="submit"
                    className={`text-xl leading-none ${statusColors[d.status]} hover:opacity-70 transition-opacity`}
                    title={`Mark as ${nextStatus.replace(/_/g, ' ')}`}
                  >
                    {statusIcons[d.status]}
                  </button>
                </form>

                <div className="flex-1 min-w-0">
                  <span
                    className={`text-sm ${d.status === 'delivered' ? 'line-through text-gray-500' : 'text-white'}`}
                  >
                    {d.title}
                  </span>
                  {d.due_date && (
                    <span className="ml-2 text-xs text-gray-500">
                      Due {d.due_date}
                    </span>
                  )}
                  {deliverableHours?.[d.id] && (
                    <span className="ml-2 text-xs text-blue-400">
                      {deliverableHours[d.id].toFixed(1)}h
                    </span>
                  )}
                </div>

                <form action={deleteDeliverableAction}>
                  <input type="hidden" name="id" value={d.id} />
                  <input type="hidden" name="client_id" value={clientId} />
                  <input type="hidden" name="project_id" value={projectId} />
                  <button
                    type="submit"
                    className="text-gray-600 hover:text-red-400 transition-colors text-sm"
                    title="Delete"
                  >
                    x
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      )}

      <form ref={formRef} action={handleAdd} className="flex gap-2">
        <input type="hidden" name="project_id" value={projectId} />
        <input type="hidden" name="client_id" value={clientId} />
        <input
          type="text"
          name="title"
          required
          placeholder="New deliverable..."
          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
        />
        <input
          type="date"
          name="due_date"
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 text-sm"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm"
        >
          Add
        </button>
      </form>
    </div>
  );
}
