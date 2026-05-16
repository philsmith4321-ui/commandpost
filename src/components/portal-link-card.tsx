'use client';

import { useRef, useState } from 'react';
import { generatePortalTokenAction, resetPortalTokenAction } from '@/lib/actions/portal-actions';

export function PortalLinkCard({ clientId, token }: { clientId: number; token: string | null }) {
  const [copied, setCopied] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const portalUrl = token ? `${typeof window !== 'undefined' ? window.location.origin : ''}/portal/${token}` : null;

  function handleCopy() {
    if (portalUrl) {
      navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleReset() {
    if (confirm('Reset portal link? The old link will stop working.')) {
      formRef.current?.requestSubmit();
    }
  }

  return (
    <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
      <h3 className="text-sm font-semibold text-white mb-3">Client Portal</h3>
      {token ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={portalUrl || ''}
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs truncate"
            />
            <button
              onClick={handleCopy}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <form ref={formRef} action={resetPortalTokenAction}>
            <input type="hidden" name="client_id" value={clientId} />
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              Reset Link
            </button>
          </form>
        </div>
      ) : (
        <form action={generatePortalTokenAction}>
          <input type="hidden" name="client_id" value={clientId} />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
          >
            Generate Portal Link
          </button>
        </form>
      )}
    </div>
  );
}
