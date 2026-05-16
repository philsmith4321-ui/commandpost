'use client';

import { useActionState } from 'react';
import { generateFollowUp, type FollowUpResult } from '@/lib/actions/lead-actions';

export function FollowUpDraft({ leadId, isConfigured }: { leadId: number; isConfigured: boolean }) {
  const [state, formAction, isPending] = useActionState<FollowUpResult | null, FormData>(
    generateFollowUp,
    null
  );

  if (!isConfigured) return null;

  return (
    <div className="mb-8">
      <form action={formAction}>
        <input type="hidden" name="id" value={leadId} />
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:text-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {isPending ? 'Generating...' : 'Draft Follow-up'}
        </button>
      </form>

      {state && 'error' in state && (
        <div className="mt-3 p-4 bg-red-900/10 border border-red-900 rounded-lg text-sm text-red-400">
          {state.error}
        </div>
      )}

      {state && 'email_subject' in state && (
        <div className="mt-4 space-y-4">
          {/* Email Draft */}
          <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-400">Email Draft</h4>
              <CopyButton text={`Subject: ${state.email_subject}\n\n${state.email_body}`} />
            </div>
            <p className="text-sm font-medium text-white mb-2">Subject: {state.email_subject}</p>
            <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans">{state.email_body}</pre>
          </div>

          {/* Talking Points */}
          {state.talking_points.length > 0 && (
            <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Talking Points (Phone Call)</h4>
              <ul className="space-y-2">
                {state.talking_points.map((point, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-300">
                    <span className="text-blue-400 shrink-0">{i + 1}.</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
      }}
      className="px-3 py-1 text-xs text-gray-400 hover:text-white border border-gray-700 rounded hover:border-gray-600 transition-colors"
    >
      Copy
    </button>
  );
}
