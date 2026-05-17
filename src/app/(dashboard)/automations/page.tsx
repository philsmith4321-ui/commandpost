import { getDb } from '@/lib/db';
import { listAutomations, getAutomationLogs, TRIGGER_TYPES, ACTION_TYPES } from '@/lib/queries/automation-queries';
import { createAutomationAction, toggleAutomationAction, deleteAutomationAction } from '@/lib/actions/automation-actions';

export const dynamic = 'force-dynamic';

export default function AutomationsPage() {
  const db = getDb();
  const automations = listAutomations(db);
  const logs = getAutomationLogs(db, 20);

  return (
    <div className="p-4 sm:p-6">
      <h2 className="text-2xl font-bold mb-6">Workflow Automations</h2>

      {/* Create new automation */}
      <form action={createAutomationAction} className="mb-8 p-4 bg-gray-900 border border-gray-800 rounded-lg">
        <h3 className="text-sm font-medium text-gray-400 uppercase mb-3">New Automation</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <input name="name" placeholder="Automation name" required
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
          <select name="trigger_type" required
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
            <option value="">Select trigger...</option>
            {TRIGGER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select name="action_type" required
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
            <option value="">Select action...</option>
            {ACTION_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
          <input name="action_config" placeholder="Action config (JSON, optional)"
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium">
          Create Automation
        </button>
      </form>

      {/* Automations list */}
      {automations.length === 0 ? (
        <p className="text-gray-500 mb-8">No automations yet. Create one above to automate your workflows.</p>
      ) : (
        <div className="space-y-3 mb-8">
          {automations.map((auto) => {
            const trigger = TRIGGER_TYPES.find(t => t.value === auto.trigger_type);
            const action = ACTION_TYPES.find(a => a.value === auto.action_type);
            return (
              <div key={auto.id} className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-lg">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${auto.enabled ? 'bg-green-400' : 'bg-gray-600'}`} />
                    <h4 className="text-sm font-medium text-white">{auto.name}</h4>
                  </div>
                  <p className="text-xs text-gray-500">
                    When: <span className="text-gray-400">{trigger?.label || auto.trigger_type}</span>
                    {' → '}
                    Then: <span className="text-gray-400">{action?.label || auto.action_type}</span>
                  </p>
                  {auto.last_run && (
                    <p className="text-xs text-gray-600 mt-1">Last run: {new Date(auto.last_run + 'Z').toLocaleString()}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <form action={toggleAutomationAction}>
                    <input type="hidden" name="id" value={auto.id} />
                    <button type="submit" className={`px-3 py-1 text-xs rounded ${auto.enabled ? 'bg-yellow-900/50 text-yellow-400' : 'bg-green-900/50 text-green-400'}`}>
                      {auto.enabled ? 'Disable' : 'Enable'}
                    </button>
                  </form>
                  <form action={deleteAutomationAction}>
                    <input type="hidden" name="id" value={auto.id} />
                    <button type="submit" className="px-3 py-1 text-xs bg-red-900/50 text-red-400 rounded">
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent automation log */}
      {logs.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-400 uppercase mb-3">Recent Activity</h3>
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center justify-between p-3 bg-gray-900/50 border border-gray-800/50 rounded-lg text-xs">
                <div>
                  <span className="text-gray-400">{log.trigger_detail}</span>
                  <span className="text-gray-600"> → </span>
                  <span className="text-gray-300">{log.action_detail}</span>
                </div>
                <span className="text-gray-600 whitespace-nowrap">{new Date(log.ran_at + 'Z').toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
