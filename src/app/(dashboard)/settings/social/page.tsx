import Link from 'next/link';
import { isBufferConfigured } from '@/lib/buffer/client';
import { listChannels } from '@/lib/buffer/queries';
import type { BufferChannel } from '@/lib/buffer/types';

export const dynamic = 'force-dynamic';

export default async function SocialSettingsPage() {
  const configured = isBufferConfigured();
  let channels: BufferChannel[] = [];
  let error: string | null = null;
  if (configured) {
    try {
      channels = await listChannels();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to reach Buffer';
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl">
      <Link href="/settings" className="text-sm text-gray-400 hover:text-gray-200">← Settings</Link>
      <h2 className="text-2xl font-bold my-4">Social / Buffer</h2>

      <div className="mb-6">
        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${configured && !error ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
          <span className="w-2 h-2 rounded-full bg-current" />
          {configured ? (error ? 'Connected, but API error' : 'Connected') : 'Not configured'}
        </span>
        {!configured && (
          <p className="text-sm text-gray-400 mt-2">Set <code>BUFFER_API_KEY</code> and <code>BUFFER_ORG_ID</code> in the server <code>.env</code>.</p>
        )}
        {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
      </div>

      {channels.length > 0 && (
        <div>
          <h3 className="text-sm text-gray-400 mb-2">Connected channels</h3>
          <ul className="space-y-2">
            {channels.map((c) => (
              <li key={c.id} className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-sm">
                <span>{c.name}</span>
                <span className="text-gray-500">{c.platform ?? c.service}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
