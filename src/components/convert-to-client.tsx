'use client';

import { convertLeadToClientAction } from '@/lib/actions/lead-actions';

export function ConvertToClient({ leadId }: { leadId: number }) {
  return (
    <form action={convertLeadToClientAction}>
      <input type="hidden" name="lead_id" value={leadId} />
      <button
        type="submit"
        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
        onClick={(e) => {
          if (!confirm('Mark this lead as Won and create a new Client record?')) {
            e.preventDefault();
          }
        }}
      >
        Mark Won &amp; Convert to Client
      </button>
    </form>
  );
}
