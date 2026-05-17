import { getDb } from '@/lib/db';
import { listWebhooks } from '@/lib/queries/webhook-queries';
import { createWebhookAction, deleteWebhookAction, toggleWebhookAction } from '@/lib/actions/webhook-actions';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const WEBHOOK_EVENTS = [
  'invoice_paid', 'invoice_created', 'invoice_overdue',
  'proposal_accepted', 'proposal_sent',
  'client_created', 'lead_stage_changed',
  'project_completed',
];

export default function WebhooksPage() {
  const db = getDb();
  const webhooks = listWebhooks(db);

  return (
    <div className="p-4 sm:p-6 max-w-3xl">
      <Link href="/settings" className="text-sm text-gray-400 hover:text-white mb-4 inline-block">&larr; Back to Settings</Link>
      <h2 className="text-2xl font-bold mb-6">Webhooks</h2>

      <form action={createWebhookAction} className="mb-6 p-4 bg-gray-900 border border-gray-800 rounded-lg">
        <h3 className="text-sm font-medium text-gray-400 uppercase mb-3">New Webhook</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <input name="name" required placeholder="Name" className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
          <input name="url" type="url" required placeholder="https://..." className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
          <input name="secret" placeholder="Secret (optional)" className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
          <select name="events" required className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
            <option value="">Select event...</option>
            {WEBHOOK_EVENTS.map(e => <option key={e} value={e}>{e}</option>)}
            <option value={WEBHOOK_EVENTS.join(',')}>All events</option>
          </select>
        </div>
        <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium">Create</button>
      </form>

      {webhooks.length === 0 ? (
        <p className="text-gray-500 text-sm">No webhooks configured.</p>
      ) : (
        <div className="space-y-3">
          {webhooks.map(wh => (
            <div key={wh.id} className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-lg">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${wh.enabled ? 'bg-green-400' : 'bg-gray-600'}`} />
                  <span className="text-sm font-medium text-white">{wh.name}</span>
                </div>
                <p className="text-xs text-gray-500 truncate max-w-md">{wh.url}</p>
                <p className="text-xs text-gray-600 mt-0.5">Events: {wh.events}</p>
                {wh.last_triggered && <p className="text-xs text-gray-600">Last: {new Date(wh.last_triggered + 'Z').toLocaleString()}</p>}
              </div>
              <div className="flex gap-2">
                <form action={toggleWebhookAction}>
                  <input type="hidden" name="id" value={wh.id} />
                  <button type="submit" className={`px-3 py-1 text-xs rounded ${wh.enabled ? 'bg-yellow-900/50 text-yellow-400' : 'bg-green-900/50 text-green-400'}`}>
                    {wh.enabled ? 'Disable' : 'Enable'}
                  </button>
                </form>
                <form action={deleteWebhookAction}>
                  <input type="hidden" name="id" value={wh.id} />
                  <button type="submit" className="px-3 py-1 text-xs bg-red-900/50 text-red-400 rounded">Delete</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
