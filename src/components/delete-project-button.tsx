'use client';

import { deleteProjectAction } from '@/lib/actions/project-actions';

export function DeleteProjectButton({ projectId, clientId }: { projectId: number; clientId: number }) {
  return (
    <div className="border-t border-gray-800 pt-6">
      <form
        action={deleteProjectAction}
        onSubmit={(e) => {
          if (!confirm('Are you sure you want to delete this project?')) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={projectId} />
        <input type="hidden" name="client_id" value={clientId} />
        <button
          type="submit"
          className="px-4 py-2 text-sm text-red-400 border border-red-900 hover:bg-red-900/20 rounded-lg transition-colors"
        >
          Delete Project
        </button>
      </form>
    </div>
  );
}
