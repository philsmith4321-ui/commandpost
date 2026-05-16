import { startOnboardingAction, toggleOnboardingItemAction } from '@/lib/actions/onboarding-actions';
import type { OnboardingChecklist, OnboardingTemplate } from '@/lib/queries/onboarding-queries';

export function ClientOnboarding({
  clientId,
  checklists,
  templates,
}: {
  clientId: number;
  checklists: OnboardingChecklist[];
  templates: OnboardingTemplate[];
}) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-4">
      <h3 className="font-semibold mb-3">Onboarding</h3>

      {templates.length > 0 && (
        <form action={startOnboardingAction} className="flex gap-2 mb-4">
          <input type="hidden" name="client_id" value={clientId} />
          <select name="template_id" className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm">
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button type="submit" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm">Start</button>
        </form>
      )}

      {checklists.length === 0 ? (
        <p className="text-sm text-gray-500">No onboarding checklists. {templates.length === 0 ? 'Create templates at /onboarding first.' : 'Select a template above.'}</p>
      ) : (
        <div className="space-y-4">
          {checklists.map(cl => (
            <div key={cl.id} className="border border-gray-700 rounded p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{cl.template_name}</span>
                <span className="text-xs text-gray-500">{cl.progress}%</span>
              </div>
              <div className="h-1.5 bg-gray-700 rounded-full mb-3 overflow-hidden">
                <div className={`h-full rounded-full ${cl.progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${cl.progress}%` }} />
              </div>
              <ul className="space-y-1">
                {cl.items.map(item => (
                  <li key={item.id} className="flex items-center gap-2">
                    <form action={toggleOnboardingItemAction}>
                      <input type="hidden" name="item_id" value={item.id} />
                      <input type="hidden" name="client_id" value={clientId} />
                      <button type="submit" className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${item.is_done ? 'bg-green-600 border-green-500 text-white' : 'border-gray-600 hover:border-gray-500'}`}>
                        {item.is_done ? '✓' : ''}
                      </button>
                    </form>
                    <span className={`text-sm ${item.is_done ? 'line-through text-gray-600' : 'text-gray-300'}`}>{item.title}</span>
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
