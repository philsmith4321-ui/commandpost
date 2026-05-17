import Link from 'next/link';
import { getDb } from '@/lib/db';
import { getProjectsWithProgress } from '@/lib/queries/project-queries';
import { StatusBadge } from '@/components/status-badge';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  const params = await searchParams;
  const db = getDb();
  const allProjects = getProjectsWithProgress(db);

  let projects = allProjects;
  if (params.status) {
    projects = projects.filter(p => p.status === params.status);
  }
  if (params.search) {
    const q = params.search.toLowerCase();
    projects = projects.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.client_name.toLowerCase().includes(q)
    );
  }

  const activeCount = allProjects.filter(p => p.status === 'active').length;
  const completedCount = allProjects.filter(p => p.status === 'completed').length;
  const totalHours = allProjects.reduce((sum, p) => sum + p.total_hours, 0);
  const totalRevenue = allProjects.reduce((sum, p) => sum + p.total_revenue, 0);

  const statuses = [
    { label: 'All', value: '' },
    { label: `Active (${activeCount})`, value: 'active' },
    { label: `Completed (${completedCount})`, value: 'completed' },
    { label: 'On Hold', value: 'on_hold' },
  ];

  return (
    <div className="p-4 sm:p-6">
      <h2 className="text-2xl font-bold mb-6">Projects</h2>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Total</p>
          <p className="text-2xl font-bold text-white">{allProjects.length}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Active</p>
          <p className="text-2xl font-bold text-green-400">{activeCount}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Total Hours</p>
          <p className="text-2xl font-bold text-white">{totalHours.toFixed(1)}h</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-green-400">${totalRevenue.toLocaleString()}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <form method="GET" action="/projects" className="flex-1 min-w-[200px] max-w-sm">
          {params.status && <input type="hidden" name="status" value={params.status} />}
          <input
            type="text"
            name="search"
            defaultValue={params.search || ''}
            placeholder="Search projects..."
            className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:border-blue-500 outline-none"
          />
        </form>
        <div className="flex items-center gap-2">
          {statuses.map(s => {
            const isActive = (params.status || '') === s.value;
            const qp = new URLSearchParams();
            if (params.search) qp.set('search', params.search);
            if (s.value) qp.set('status', s.value);
            return (
              <Link key={s.value} href={`/projects?${qp.toString()}`}
                className={`px-2 py-1 rounded text-xs transition-colors ${isActive ? 'bg-blue-600/20 text-blue-400' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                {s.label}
              </Link>
            );
          })}
        </div>
      </div>

      {projects.length === 0 ? (
        <p className="text-gray-500">No projects found. Add projects from client pages.</p>
      ) : (
        <div className="space-y-3">
          {projects.map(project => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: ReturnType<typeof getProjectsWithProgress>[0] }) {
  return (
    <Link href={`/clients/${project.client_id}/projects/${project.id}`}
      className="block p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className="font-medium text-white">{project.name}</span>
          <StatusBadge status={project.status} />
        </div>
        <span className="text-sm text-gray-500">{project.client_name}</span>
      </div>

      {/* Progress bar */}
      {project.total_deliverables > 0 && (
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
      )}

      <div className="flex gap-4 text-xs text-gray-500">
        {project.total_hours > 0 && <span>{project.total_hours}h logged</span>}
        {project.total_revenue > 0 && <span>${project.total_revenue.toLocaleString()} revenue</span>}
        {project.hourly_rate && <span>${project.hourly_rate}/hr</span>}
        {project.start_date && <span>Started {project.start_date}</span>}
      </div>
    </Link>
  );
}
