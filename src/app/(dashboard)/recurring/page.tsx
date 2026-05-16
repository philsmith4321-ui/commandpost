import { getDb } from '@/lib/db';
import { listRecurringTasks } from '@/lib/queries/recurring-task-queries';
import { createRecurringTaskAction, toggleRecurringTaskAction, deleteRecurringTaskAction } from '@/lib/actions/recurring-task-actions';

export const dynamic = 'force-dynamic';

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function RecurringTasksPage() {
  const db = getDb();
  const tasks = listRecurringTasks(db);
  const clients = db.prepare("SELECT id, name FROM clients WHERE status = 'active' AND deleted_at IS NULL ORDER BY name").all() as { id: number; name: string }[];
  const projects = db.prepare("SELECT id, name FROM projects WHERE status = 'active' ORDER BY name").all() as { id: number; name: string }[];

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-bold mb-6">Recurring Tasks</h1>

      {/* Create Form */}
      <form action={createRecurringTaskAction} className="p-4 bg-gray-900 border border-gray-800 rounded-lg mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <input type="text" name="title" required placeholder="Task title" className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
          <select name="client_id" required className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
            <option value="">Client...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select name="project_id" className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
            <option value="">Project (optional)</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select name="frequency" required className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div className="flex gap-3 items-center">
          <select name="day_of_week" className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
            <option value="">Day of week (for weekly)</option>
            {dayNames.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
          <input type="number" name="day_of_month" min="1" max="28" placeholder="Day of month" className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm w-40" />
          <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors">
            Create
          </button>
        </div>
      </form>

      {/* Tasks List */}
      {tasks.length === 0 ? (
        <p className="text-gray-500 text-sm">No recurring tasks yet.</p>
      ) : (
        <div className="space-y-2">
          {tasks.map(task => (
            <div key={task.id} className={`flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-lg ${!task.is_active ? 'opacity-50' : ''}`}>
              <div>
                <p className="text-sm text-white font-medium">{task.title}</p>
                <p className="text-xs text-gray-500">
                  {task.client_name}{task.project_name ? ` / ${task.project_name}` : ''} &middot;{' '}
                  {task.frequency === 'daily' ? 'Every day' :
                   task.frequency === 'weekly' ? `Every ${dayNames[task.day_of_week || 0]}` :
                   `Monthly on day ${task.day_of_month || 1}`}
                  {task.last_generated_at && <span className="ml-2 text-gray-600">Last: {task.last_generated_at}</span>}
                </p>
              </div>
              <div className="flex gap-2">
                <form action={toggleRecurringTaskAction}>
                  <input type="hidden" name="id" value={task.id} />
                  <button type="submit" className={`text-xs px-2 py-1 rounded ${task.is_active ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
                    {task.is_active ? 'Active' : 'Paused'}
                  </button>
                </form>
                <form action={deleteRecurringTaskAction}>
                  <input type="hidden" name="id" value={task.id} />
                  <button type="submit" className="text-xs px-2 py-1 text-red-400 hover:text-red-300">Delete</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
