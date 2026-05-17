import Link from 'next/link';
import { getDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

interface ProjectBudget {
  id: number;
  name: string;
  client_name: string;
  status: string;
  budget: number | null;
  spent: number;
  hours: number;
}

async function updateBudgetAction(formData: FormData) {
  'use server';
  const db = getDb();
  const id = Number(formData.get('id'));
  const budget = formData.get('budget') ? Number(formData.get('budget')) : null;
  db.prepare("UPDATE projects SET budget = ?, updated_at = datetime('now') WHERE id = ?").run(budget, id);
  revalidatePath('/projects/budgets');
}

export default function ProjectBudgetsPage() {
  const db = getDb();

  const projects = db.prepare(`
    SELECT p.id, p.name, c.name as client_name, p.status, p.budget,
      COALESCE(SUM(te.duration_minutes * te.hourly_rate / 60), 0) as spent,
      COALESCE(SUM(te.duration_minutes), 0) / 60.0 as hours
    FROM projects p
    JOIN clients c ON c.id = p.client_id
    LEFT JOIN time_entries te ON te.project_id = p.id
    WHERE p.status = 'active'
    GROUP BY p.id
    ORDER BY p.name
  `).all() as ProjectBudget[];

  const totalBudget = projects.reduce((s, p) => s + (p.budget || 0), 0);
  const totalSpent = projects.reduce((s, p) => s + p.spent, 0);
  const overBudget = projects.filter(p => p.budget && p.spent > p.budget).length;

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Project Budgets</h2>
        <Link href="/projects" className="text-sm text-gray-400 hover:text-white">&larr; Projects</Link>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Total Budget</p>
          <p className="text-2xl font-bold text-white">${totalBudget.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Total Spent</p>
          <p className="text-2xl font-bold text-white">${totalSpent.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Over Budget</p>
          <p className={`text-2xl font-bold ${overBudget > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {overBudget} project{overBudget !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {projects.map(p => {
          const pct = p.budget ? Math.min((p.spent / p.budget) * 100, 100) : 0;
          const isOver = p.budget ? p.spent > p.budget : false;
          const remaining = p.budget ? p.budget - p.spent : null;

          return (
            <div key={p.id} className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-white font-medium">{p.name}</span>
                  <span className="text-xs text-gray-500 ml-2">{p.client_name}</span>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-medium ${isOver ? 'text-red-400' : 'text-white'}`}>
                    ${p.spent.toLocaleString()}
                  </span>
                  {p.budget ? (
                    <span className="text-sm text-gray-500"> / ${p.budget.toLocaleString()}</span>
                  ) : (
                    <span className="text-xs text-gray-600 ml-1">(no budget)</span>
                  )}
                </div>
              </div>

              {p.budget ? (
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isOver ? 'bg-red-500' : pct > 80 ? 'bg-yellow-500' : 'bg-green-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className={`text-xs ${isOver ? 'text-red-400' : 'text-gray-400'}`}>
                    {remaining !== null && remaining >= 0 ? `$${remaining.toLocaleString()} left` : `$${Math.abs(remaining || 0).toLocaleString()} over`}
                  </span>
                </div>
              ) : (
                <form action={updateBudgetAction} className="flex items-center gap-2 mt-1">
                  <input type="hidden" name="id" value={p.id} />
                  <input type="number" name="budget" placeholder="Set budget" step="100" min="0"
                    className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-xs w-28" />
                  <button type="submit" className="px-2 py-1 text-xs bg-blue-600 text-white rounded">Set</button>
                </form>
              )}

              <p className="text-xs text-gray-500 mt-1">{p.hours.toFixed(1)}h logged</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
