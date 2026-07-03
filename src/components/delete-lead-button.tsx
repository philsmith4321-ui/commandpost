'use client';

import { deleteLeadAction } from '@/lib/actions/lead-actions';

export function DeleteLeadButton({ leadId }: { leadId: number }) {
  return (
    <form action={deleteLeadAction}>
      <input type="hidden" name="id" value={leadId} />
      <button
        type="submit"
        className="px-4 py-2 text-sm text-red-400 border border-red-900 rounded-lg hover:bg-red-900/20 transition-colors"
        onClick={(e) => {
          if (!confirm('Delete this lead?')) {
            e.preventDefault();
          }
        }}
      >
        Delete Lead
      </button>
    </form>
  );
}
