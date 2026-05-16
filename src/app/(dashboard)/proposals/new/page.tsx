import { getDb } from '@/lib/db';
import { createProposalAction } from '@/lib/actions/proposal-actions';
import { ProposalItemsForm } from '@/components/proposal-items-form';

export const dynamic = 'force-dynamic';

export default function NewProposalPage() {
  const db = getDb();
  const leads = db.prepare("SELECT id, business_name FROM leads WHERE stage NOT IN ('won','lost') ORDER BY business_name").all() as { id: number; business_name: string }[];
  const clients = db.prepare("SELECT id, name FROM clients WHERE status = 'active' AND deleted_at IS NULL ORDER BY name").all() as { id: number; name: string }[];

  return (
    <div className="p-4 sm:p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">New Proposal</h1>
      <form action={createProposalAction} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Title</label>
          <input type="text" name="title" required className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Lead</label>
            <select name="lead_id" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
              <option value="">None</option>
              {leads.map(l => <option key={l.id} value={l.id}>{l.business_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Or Client</label>
            <select name="client_id" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
              <option value="">None</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Scope</label>
          <textarea name="scope" rows={4} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Timeline</label>
            <input type="text" name="timeline" placeholder="e.g. 4-6 weeks" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Valid Until</label>
            <input type="date" name="valid_until" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
          </div>
        </div>
        <ProposalItemsForm />
        <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors">
          Save as Draft
        </button>
      </form>
    </div>
  );
}
