'use client';

import { useState } from 'react';
import { sendProposalEmailAction } from '@/lib/actions/proposal-actions';

export function SendProposalEmail({ proposalId, recipientEmail, title, amount }: {
  proposalId: number;
  recipientEmail: string | null;
  title: string;
  amount: number;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors">
        Email Proposal
      </button>
    );
  }

  return (
    <form action={sendProposalEmailAction} className="p-4 bg-gray-900 border border-gray-800 rounded-lg space-y-3">
      <input type="hidden" name="id" value={proposalId} />
      <div>
        <label className="text-xs text-gray-500 uppercase">Recipient Email</label>
        <input name="email" type="email" required defaultValue={recipientEmail || ''}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm mt-1" />
      </div>
      <div>
        <label className="text-xs text-gray-500 uppercase">Message (optional)</label>
        <textarea name="message" rows={3}
          defaultValue={`Please review the attached proposal for ${title}. The total is $${amount.toLocaleString()}. We look forward to working with you!`}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm mt-1 resize-none" />
      </div>
      <div className="flex gap-2">
        <button type="submit" className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg">
          Send Email
        </button>
        <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
          Cancel
        </button>
      </div>
    </form>
  );
}
