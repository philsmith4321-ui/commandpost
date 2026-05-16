import { getDb } from '@/lib/db';
import { getAutoCalculatedGoals } from '@/lib/queries/goal-queries';
import { createGoalAction, deleteGoalAction } from '@/lib/actions/goal-actions';

export const dynamic = 'force-dynamic';

export default function GoalsPage() {
  const db = getDb();
  const goals = getAutoCalculatedGoals(db);

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-bold mb-6">Goals</h1>

      {/* Active Goals */}
      {goals.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          {goals.map(goal => {
            const progress = Math.min((goal.current_value / goal.target_value) * 100, 100);
            const isComplete = goal.current_value >= goal.target_value;
            return (
              <div key={goal.id} className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-white font-medium text-sm">{goal.title}</h3>
                  <form action={deleteGoalAction}>
                    <input type="hidden" name="id" value={goal.id} />
                    <button type="submit" className="text-xs text-gray-600 hover:text-red-400">×</button>
                  </form>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  {goal.period} &middot; {goal.period_start} → {goal.period_end}
                </p>
                <div className="mb-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className={isComplete ? 'text-green-400' : 'text-white'}>
                      {goal.unit === 'revenue' ? `$${goal.current_value.toLocaleString()}` : goal.current_value}
                    </span>
                    <span className="text-gray-500">
                      {goal.unit === 'revenue' ? `$${goal.target_value.toLocaleString()}` : goal.target_value} {goal.unit !== 'revenue' ? goal.unit : ''}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isComplete ? 'bg-green-500' : 'bg-blue-600'}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500">{Math.round(progress)}% complete</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Goal */}
      <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
        <h3 className="text-sm font-medium text-gray-400 mb-3">New Goal</h3>
        <form action={createGoalAction} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input type="text" name="title" required placeholder="Goal title" className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
            <input type="number" name="target_value" required placeholder="Target value" step="0.01" className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
            <select name="unit" required className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
              <option value="revenue">Revenue ($)</option>
              <option value="clients">New Clients</option>
              <option value="hours">Hours Logged</option>
              <option value="deals">Deals Won</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select name="period" required className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
              <option value="weekly">Weekly</option>
            </select>
            <input type="date" name="period_start" required defaultValue={monthStart} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
            <input type="date" name="period_end" required defaultValue={monthEnd} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
          </div>
          <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors">
            Create Goal
          </button>
        </form>
      </div>
    </div>
  );
}
