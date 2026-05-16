import { getDb } from '@/lib/db';
import { createMeetingAction } from '@/lib/actions/meeting-actions';

export const dynamic = 'force-dynamic';

export default function NewMeetingPage() {
  const db = getDb();
  const clients = db.prepare("SELECT id, name FROM clients WHERE status = 'active' AND deleted_at IS NULL ORDER BY name").all() as { id: number; name: string }[];
  const projects = db.prepare("SELECT id, name FROM projects WHERE status = 'active' ORDER BY name").all() as { id: number; name: string }[];

  return (
    <div className="p-4 sm:p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Log Meeting</h1>
      <form action={createMeetingAction} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Title</label>
          <input type="text" name="title" required className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white" placeholder="e.g. Weekly check-in" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Client</label>
            <select name="client_id" required className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white">
              <option value="">Select client...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Project (optional)</label>
            <select name="project_id" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white">
              <option value="">None</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Date</label>
            <input type="date" name="meeting_date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Duration (minutes)</label>
            <input type="number" name="duration_minutes" placeholder="30" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white" />
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Notes</label>
          <textarea name="notes" rows={4} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white" placeholder="What was discussed..." />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Action Items</label>
          <textarea name="action_items" rows={3} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white" placeholder="One per line..." />
        </div>
        <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors">
          Log Meeting
        </button>
      </form>
    </div>
  );
}
