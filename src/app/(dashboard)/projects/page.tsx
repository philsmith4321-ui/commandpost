import Link from 'next/link';
import { getDb } from '@/lib/db';
import { getProjectsWithProgress } from '@/lib/queries/project-queries';
import { StatusBadge } from '@/components/status-badge';

export const dynamic = 'force-dynamic';

export default function ProjectsPage() {
  const db = getDb();
  const projects = getProjectsWithProgress(db);

  const active = projects.filter(p => p.status === 'active');
  const other = projects.filter(p => p.status !== 'active');

  return (
    <div className="p-4 sm:p-6">
      <h2 className="text-2xl font-bold mb-6">Projects</h2>

      {active.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-3">Active Projects</h3>
          <div className="space-y-3">
            {active.map(project => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </div>
      )}

      {other.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 text-gray-400">Completed / On Hold</h3>
          <div className="space-y-3">
            {other.map(project => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </div>
      )}

      {projects.length === 0 && (
        <p className="text-gray-500">No projects yet. Add projects from client pages.</p>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: ReturnType<typeof getProjectsWithProgress>[0] }) {
  return (
    <Link href={`/clients/${project.client_id}`}
      className="block p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className="font-medium text-white">{project.name}</span>
          <StatusBadge status={project.status} />
        </div>
        <span className="text-sm text-gray-500">{project.client_name}</span>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              project.progress_percent === 100 ? 'bg-green-500' :
              project.progress_percent > 50 ? 'bg-blue-500' : 'bg-gray-600'
            }`}
            style={{ width: `${project.progress_percent}%` }}
          />
        </div>
        <span className="text-xs text-gray-400 w-16 text-right">
          {project.completed_deliverables}/{project.total_deliverables}
        </span>
      </div>

      <div className="flex gap-4 text-xs text-gray-500">
        {project.total_hours > 0 && <span>{project.total_hours}h logged</span>}
        {project.total_revenue > 0 && <span>${project.total_revenue.toLocaleString()} revenue</span>}
        {project.start_date && <span>Started {project.start_date}</span>}
      </div>
    </Link>
  );
}
