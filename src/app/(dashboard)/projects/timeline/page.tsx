import Link from 'next/link';
import { getDb } from '@/lib/db';
import { listMilestones } from '@/lib/queries/milestone-queries';
import { createMilestoneAction, updateMilestoneStatusAction, deleteMilestoneAction } from '@/lib/actions/milestone-actions';

export const dynamic = 'force-dynamic';

export default function ProjectTimelinePage() {
  const db = getDb();
  const milestones = listMilestones(db);
  const projects = db.prepare(
    "SELECT p.id, p.name, c.name as client_name FROM projects p JOIN clients c ON c.id = p.client_id ORDER BY p.name"
  ).all() as { id: number; name: string; client_name: string }[];

  // Calculate timeline range
  const today = new Date();
  const dates = milestones.flatMap(m => [new Date(m.start_date), new Date(m.end_date)]);
  dates.push(today);
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
  // Add padding
  minDate.setDate(minDate.getDate() - 7);
  maxDate.setDate(maxDate.getDate() + 14);
  const totalDays = Math.max(Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)), 30);

  const getPosition = (dateStr: string) => {
    const d = new Date(dateStr);
    const days = (d.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
    return (days / totalDays) * 100;
  };

  const todayPos = getPosition(today.toISOString().split('T')[0]);

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    pink: 'bg-pink-500',
  };

  // Group milestones by project
  const grouped = new Map<string, typeof milestones>();
  for (const m of milestones) {
    const key = m.project_name || 'Unknown';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(m);
  }

  // Month markers
  const months: { label: string; pos: number }[] = [];
  const cursor = new Date(minDate);
  cursor.setDate(1);
  cursor.setMonth(cursor.getMonth() + 1);
  while (cursor <= maxDate) {
    months.push({
      label: cursor.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      pos: getPosition(cursor.toISOString().split('T')[0]),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Project Timeline</h2>
        <Link href="/projects" className="text-sm text-gray-400 hover:text-white">&larr; Projects</Link>
      </div>

      {/* Add Milestone Form */}
      <form action={createMilestoneAction} className="flex flex-wrap gap-3 mb-6 p-4 bg-gray-900 border border-gray-800 rounded-lg">
        <select name="project_id" required className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
          <option value="">Select Project</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name} ({p.client_name})</option>)}
        </select>
        <input name="title" placeholder="Milestone title" required className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
        <input name="start_date" type="date" required className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
        <input name="end_date" type="date" required className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
        <select name="color" className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
          <option value="blue">Blue</option>
          <option value="green">Green</option>
          <option value="purple">Purple</option>
          <option value="yellow">Yellow</option>
          <option value="red">Red</option>
          <option value="pink">Pink</option>
        </select>
        <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg">Add Milestone</button>
      </form>

      {milestones.length === 0 ? (
        <p className="text-sm text-gray-500">No milestones yet. Add one above to start building your timeline.</p>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 overflow-x-auto">
          {/* Month headers */}
          <div className="relative h-6 mb-2 border-b border-gray-800">
            {months.map((m, i) => (
              <span key={i} className="absolute text-xs text-gray-500" style={{ left: `${m.pos}%` }}>{m.label}</span>
            ))}
          </div>

          {/* Today marker */}
          <div className="relative">
            <div className="absolute top-0 bottom-0 w-px bg-red-500/50 z-10" style={{ left: `${todayPos}%` }}>
              <span className="absolute -top-5 -translate-x-1/2 text-xs text-red-400">Today</span>
            </div>

            {/* Gantt rows */}
            <div className="space-y-1">
              {Array.from(grouped.entries()).map(([projectName, items]) => (
                <div key={projectName}>
                  <p className="text-xs text-gray-500 mb-1 mt-2">{projectName}</p>
                  {items.map(m => {
                    const left = getPosition(m.start_date);
                    const right = getPosition(m.end_date);
                    const width = Math.max(right - left, 1);
                    const bgClass = colorMap[m.color] || 'bg-blue-500';
                    const opacity = m.status === 'completed' ? 'opacity-50' : '';
                    return (
                      <div key={m.id} className="relative h-8 mb-1">
                        <div
                          className={`absolute top-0 h-full ${bgClass} ${opacity} rounded flex items-center px-2 group cursor-default`}
                          style={{ left: `${left}%`, width: `${width}%`, minWidth: '60px' }}
                        >
                          <span className="text-xs text-white truncate">{m.title}</span>
                          <div className="hidden group-hover:flex absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg p-2 z-20 gap-1">
                            <form action={updateMilestoneStatusAction}>
                              <input type="hidden" name="id" value={m.id} />
                              <input type="hidden" name="status" value={m.status === 'completed' ? 'planned' : m.status === 'in_progress' ? 'completed' : 'in_progress'} />
                              <button type="submit" className="text-xs text-blue-400 hover:text-blue-300 whitespace-nowrap">
                                {m.status === 'completed' ? 'Reopen' : m.status === 'in_progress' ? 'Complete' : 'Start'}
                              </button>
                            </form>
                            <form action={deleteMilestoneAction}>
                              <input type="hidden" name="id" value={m.id} />
                              <button type="submit" className="text-xs text-red-400 hover:text-red-300 ml-2">Delete</button>
                            </form>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
