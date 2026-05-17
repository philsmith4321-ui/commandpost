import Link from 'next/link';
import { getDb } from '@/lib/db';
import { listProposalTemplates } from '@/lib/queries/proposal-template-queries';
import { createProposalTemplateAction, deleteProposalTemplateAction, useProposalTemplateAction } from '@/lib/actions/proposal-template-actions';

export const dynamic = 'force-dynamic';

export default function ProposalTemplatesPage() {
  const db = getDb();
  const templates = listProposalTemplates(db);
  const clients = db.prepare("SELECT id, name FROM clients WHERE deleted_at IS NULL ORDER BY name").all() as { id: number; name: string }[];
  const leads = db.prepare("SELECT id, business_name FROM leads WHERE stage NOT IN ('won','lost') ORDER BY business_name").all() as { id: number; business_name: string }[];

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Proposal Templates</h2>
        <Link href="/proposals" className="text-sm text-gray-400 hover:text-white">&larr; Proposals</Link>
      </div>

      {/* Existing Templates */}
      {templates.length > 0 && (
        <div className="space-y-4 mb-8">
          {templates.map(t => {
            const total = t.items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
            return (
              <div key={t.id} className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-white font-medium">{t.name}</h3>
                    {t.scope && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{t.scope}</p>}
                    <p className="text-sm text-green-400 mt-1">${total.toLocaleString()} total</p>
                    <p className="text-xs text-gray-500">{t.items.length} line items &middot; {t.valid_days} day validity</p>
                  </div>
                  <form action={deleteProposalTemplateAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <button type="submit" className="text-xs text-red-400 hover:text-red-300">Delete</button>
                  </form>
                </div>
                {/* Use Template */}
                <form action={useProposalTemplateAction} className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-800">
                  <input type="hidden" name="template_id" value={t.id} />
                  <select name="client_id" className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white">
                    <option value="">No client</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select name="lead_id" className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white">
                    <option value="">No lead</option>
                    {leads.map(l => <option key={l.id} value={l.id}>{l.business_name}</option>)}
                  </select>
                  <button type="submit" className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded">
                    Create Proposal
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Template */}
      <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
        <h3 className="text-white font-medium mb-3">New Template</h3>
        <form action={createProposalTemplateAction} className="space-y-3">
          <input name="name" placeholder="Template name" required
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
          <textarea name="scope" placeholder="Scope of work" rows={3}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm resize-none" />
          <div className="flex gap-3">
            <input name="timeline" placeholder="Timeline (e.g. 4 weeks)"
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
            <input name="valid_days" type="number" placeholder="Valid days" defaultValue="30" min="1"
              className="w-28 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase mb-2">Line Items</p>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input name="item_description" placeholder="Description" className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm" />
                <input name="item_quantity" type="number" placeholder="Qty" defaultValue="1" min="1" className="w-16 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm" />
                <input name="item_unit_price" type="number" placeholder="Price" min="0" step="0.01" className="w-24 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm" />
              </div>
              <div className="flex gap-2">
                <input name="item_description" placeholder="Description" className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm" />
                <input name="item_quantity" type="number" placeholder="Qty" defaultValue="1" min="1" className="w-16 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm" />
                <input name="item_unit_price" type="number" placeholder="Price" min="0" step="0.01" className="w-24 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm" />
              </div>
              <div className="flex gap-2">
                <input name="item_description" placeholder="Description" className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm" />
                <input name="item_quantity" type="number" placeholder="Qty" defaultValue="1" min="1" className="w-16 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm" />
                <input name="item_unit_price" type="number" placeholder="Price" min="0" step="0.01" className="w-24 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm" />
              </div>
            </div>
          </div>
          <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg">Save Template</button>
        </form>
      </div>
    </div>
  );
}
