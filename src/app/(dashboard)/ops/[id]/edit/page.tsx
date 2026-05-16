import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getEndpointById } from '@/lib/queries/endpoint-queries';
import { updateEndpointAction } from '@/lib/actions/endpoint-actions';

export const dynamic = 'force-dynamic';

export default async function EditEndpointPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const endpoint = getEndpointById(db, Number(id));

  if (!endpoint) notFound();

  return (
    <div className="p-4 sm:p-6">
      <Link href={`/ops/${endpoint.id}`} className="text-sm text-gray-400 hover:text-white mb-4 inline-block">
        &larr; Back to {endpoint.name}
      </Link>
      <h2 className="text-2xl font-bold mb-6">Edit Endpoint</h2>

      <form action={updateEndpointAction} className="space-y-4 max-w-lg">
        <input type="hidden" name="id" value={endpoint.id} />
        <div>
          <label className="block text-sm text-gray-400 mb-1">Name *</label>
          <input type="text" name="name" required defaultValue={endpoint.name}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">URL *</label>
          <input type="url" name="url" required defaultValue={endpoint.url}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Check Interval (seconds)</label>
            <input type="number" name="check_interval_seconds" defaultValue={endpoint.check_interval_seconds}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Slow Threshold (ms)</label>
            <input type="number" name="slow_threshold_ms" defaultValue={endpoint.slow_threshold_ms}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" name="is_active" id="is_active" defaultChecked={endpoint.is_active === 1}
            className="rounded bg-gray-800 border-gray-700" />
          <label htmlFor="is_active" className="text-sm text-gray-400">Active</label>
        </div>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Update Endpoint
        </button>
      </form>
    </div>
  );
}
