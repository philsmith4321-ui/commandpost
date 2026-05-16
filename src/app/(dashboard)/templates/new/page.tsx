import { createTemplateAction } from '@/lib/actions/template-actions';
import { TemplateDeliverablesForm } from '@/components/template-deliverables-form';

export default function NewTemplatePage() {
  return (
    <div className="p-4 sm:p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">New Project Template</h1>
      <form action={createTemplateAction} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Template Name</label>
          <input type="text" name="name" required className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white" placeholder="e.g. Standard Website Build" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Description</label>
          <textarea name="description" rows={2} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white" placeholder="Brief description of what this template covers" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Default Hourly Rate</label>
            <input type="number" name="hourly_rate" step="0.01" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Stack Notes</label>
            <input type="text" name="stack_notes" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white" placeholder="e.g. Next.js, Tailwind" />
          </div>
        </div>

        <div className="border-t border-gray-800 pt-4">
          <label className="block text-sm text-gray-400 mb-2">Deliverables (days offset from project start)</label>
          <TemplateDeliverablesForm />
        </div>

        <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors">
          Create Template
        </button>
      </form>
    </div>
  );
}
