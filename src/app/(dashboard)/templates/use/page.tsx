import { getDb } from '@/lib/db';
import { listTemplates, getTemplateDeliverables } from '@/lib/queries/template-queries';
import { createProjectFromTemplateAction } from '@/lib/actions/template-actions';
import type { Client } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default function UseTemplatePage() {
  const db = getDb();
  const templates = listTemplates(db);
  const clients = db.prepare("SELECT id, name FROM clients WHERE status = 'active' AND deleted_at IS NULL ORDER BY name").all() as Client[];

  return (
    <div className="p-4 sm:p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Create Project from Template</h1>
      {templates.length === 0 ? (
        <p className="text-gray-500 text-sm">No templates available. Create one first.</p>
      ) : (
        <form action={createProjectFromTemplateAction} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Template</label>
            <select name="template_id" required className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white">
              <option value="">Select a template...</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.description ? ` — ${t.description}` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Client</label>
            <select name="client_id" required className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white">
              <option value="">Select a client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Project Name</label>
            <input type="text" name="project_name" required className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white" placeholder="e.g. Acme Corp Website Redesign" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Start Date</label>
            <input type="date" name="start_date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white" />
          </div>
          <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors">
            Create Project
          </button>
        </form>
      )}
    </div>
  );
}
