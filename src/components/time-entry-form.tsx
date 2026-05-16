'use client';

import { useRef } from 'react';
import type { Deliverable } from '@/lib/types';
import { logTimeAction } from '@/lib/actions/time-actions';

interface TimeEntryFormProps {
  clientId: number;
  projectId: number;
  deliverables: Deliverable[];
  defaultRate: number | null;
}

export function TimeEntryForm({ clientId, projectId, deliverables, defaultRate }: TimeEntryFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const today = new Date().toISOString().slice(0, 10);

  const inputClass =
    'w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm';

  async function handleSubmit(formData: FormData) {
    await logTimeAction(formData);
    formRef.current?.reset();
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-white mb-4">Log Time</h3>
      <form ref={formRef} action={handleSubmit} className="space-y-4">
        <input type="hidden" name="project_id" value={projectId} />
        <input type="hidden" name="client_id" value={clientId} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Deliverable</label>
            <select name="deliverable_id" className={inputClass}>
              <option value="">Project-level (no deliverable)</option>
              {deliverables.map((d) => (
                <option key={d.id} value={d.id}>{d.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Date</label>
            <input type="date" name="entry_date" defaultValue={today} required className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Hours</label>
            <input type="number" name="hours" min="0" defaultValue="0" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Minutes</label>
            <input type="number" name="minutes" min="0" max="59" defaultValue="0" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Rate ($/hr)</label>
            <input type="number" name="hourly_rate" step="0.01" min="0" defaultValue={defaultRate ?? ''} required className={inputClass} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Description (optional)</label>
          <input type="text" name="description" placeholder="What did you work on?" className={inputClass} />
        </div>

        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm"
        >
          Log Time
        </button>
      </form>
    </div>
  );
}
