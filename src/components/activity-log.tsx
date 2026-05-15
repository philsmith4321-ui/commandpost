'use client';

import { useRef } from 'react';
import type { ActivityLog as ActivityLogType } from '@/lib/types';
import { addActivityAction } from '@/lib/actions/activity-actions';

interface ActivityLogProps {
  clientId: number;
  projectId?: number;
  activities: ActivityLogType[];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'Z');
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function ActivityLog({ clientId, projectId, activities }: ActivityLogProps) {
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    await addActivityAction(formData);
    formRef.current?.reset();
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-white mb-4">Activity Log</h3>

      <form ref={formRef} action={handleSubmit} className="mb-6">
        <input type="hidden" name="client_id" value={clientId} />
        {projectId && <input type="hidden" name="project_id" value={projectId} />}
        <div className="flex gap-2">
          <input
            type="text"
            name="content"
            required
            placeholder="Add a note..."
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Add
          </button>
        </div>
      </form>

      {activities.length === 0 ? (
        <p className="text-gray-500 text-sm">No activity yet.</p>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="p-3 bg-gray-900 border border-gray-800 rounded-lg"
            >
              <p className="text-white text-sm">{activity.content}</p>
              <p className="text-gray-500 text-xs mt-1">
                {formatDate(activity.created_at)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
