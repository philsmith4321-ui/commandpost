'use client';

import { useState } from 'react';

export function ProposalAcceptButton({ token }: { token: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  async function handleAccept() {
    if (!confirm('Accept this proposal? This will confirm the engagement.')) return;
    setStatus('loading');
    try {
      const res = await fetch(`/api/proposals/${token}/accept`, { method: 'POST' });
      if (res.ok) {
        setStatus('done');
        window.location.reload();
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  if (status === 'done') return <p className="text-green-600 font-medium mt-6">Proposal accepted! Thank you.</p>;
  if (status === 'error') return <p className="text-red-600 mt-6">Something went wrong. Please try again.</p>;

  return (
    <button
      onClick={handleAccept}
      disabled={status === 'loading'}
      className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
    >
      {status === 'loading' ? 'Processing...' : 'Accept Proposal'}
    </button>
  );
}
