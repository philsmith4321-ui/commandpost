import Link from 'next/link';
import { createEndpointAction } from '@/lib/actions/endpoint-actions';

export default function NewEndpointPage() {
  return (
    <div className="p-4 sm:p-6">
      <Link href="/ops" className="text-sm text-gray-400 hover:text-white mb-4 inline-block">
        &larr; Back to Ops
      </Link>
      <h2 className="text-2xl font-bold mb-6">Add Endpoint</h2>

      <form action={createEndpointAction} className="space-y-4 max-w-lg">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Name *</label>
          <input type="text" name="name" required
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            placeholder="e.g. Paul Winkler AI" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">URL *</label>
          <input type="url" name="url" required
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            placeholder="https://example.com/health" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Check Interval (seconds)</label>
            <input type="number" name="check_interval_seconds" defaultValue={300}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Slow Threshold (ms)</label>
            <input type="number" name="slow_threshold_ms" defaultValue={5000}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" name="is_active" id="is_active" defaultChecked
            className="rounded bg-gray-800 border-gray-700" />
          <label htmlFor="is_active" className="text-sm text-gray-400">Active</label>
        </div>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Save Endpoint
        </button>
      </form>
    </div>
  );
}
