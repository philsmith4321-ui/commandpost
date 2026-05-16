import { getDb } from '@/lib/db';
import { listOnboardingTemplates } from '@/lib/queries/onboarding-queries';
import { createOnboardingTemplateAction, deleteOnboardingTemplateAction } from '@/lib/actions/onboarding-actions';

export const dynamic = 'force-dynamic';

export default function OnboardingPage() {
  const db = getDb();
  const templates = listOnboardingTemplates(db);

  return (
    <div className="p-4 sm:p-6">
      <h2 className="text-2xl font-bold mb-6">Onboarding Templates</h2>

      <form action={createOnboardingTemplateAction} className="mb-8 p-4 bg-gray-900 border border-gray-800 rounded-lg">
        <h3 className="text-sm font-medium mb-3">Create Template</h3>
        <input name="name" placeholder="Template name (e.g., Web Project Kickoff)" required
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm mb-3" />
        <textarea name="items" placeholder="Checklist items (one per line)&#10;Get hosting credentials&#10;Set up repo&#10;Initial meeting&#10;Send contract" rows={6} required
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm mb-3" />
        <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium">Create Template</button>
      </form>

      {templates.length === 0 ? (
        <p className="text-gray-500">No templates yet. Create one above.</p>
      ) : (
        <div className="space-y-4">
          {templates.map(t => (
            <div key={t.id} className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">{t.name}</h3>
                <form action={deleteOnboardingTemplateAction}>
                  <input type="hidden" name="id" value={t.id} />
                  <button type="submit" className="text-xs text-red-500 hover:text-red-400">Delete</button>
                </form>
              </div>
              <ul className="space-y-1">
                {t.items.map((item, i) => (
                  <li key={item.id} className="text-sm text-gray-400 flex items-center gap-2">
                    <span className="text-xs text-gray-600">{i + 1}.</span>
                    {item.title}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
