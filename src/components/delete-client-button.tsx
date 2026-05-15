'use client';

import { deleteClientAction } from '@/lib/actions/client-actions';

export function DeleteClientButton({ clientId }: { clientId: number }) {
  return (
    <div className="border-t border-gray-800 pt-6">
      <form
        action={deleteClientAction}
        onSubmit={(e) => {
          if (!confirm('Are you sure you want to delete this client?')) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={clientId} />
        <button
          type="submit"
          className="px-4 py-2 text-sm text-red-400 border border-red-900 hover:bg-red-900/20 rounded-lg transition-colors"
        >
          Delete Client
        </button>
      </form>
    </div>
  );
}
