'use client';

import { useActionState } from 'react';
import { loginAction } from '@/lib/actions/auth-actions';

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(
    async (_prev: { error: string } | null, formData: FormData) => {
      return await loginAction(formData);
    },
    null
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm p-8 bg-gray-900 rounded-xl border border-gray-800">
        <h1 className="text-2xl font-bold text-white mb-2">CommandPost</h1>
        <p className="text-gray-400 mb-6 text-sm">Sign in to your command center</p>

        <form action={formAction}>
          <input
            type="password"
            name="password"
            placeholder="Password"
            required
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 mb-4"
          />

          {state?.error && (
            <p className="text-red-400 text-sm mb-4">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-medium rounded-lg transition-colors"
          >
            {pending ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
