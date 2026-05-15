import Link from 'next/link';
import type { Project } from '@/lib/types';
import { StatusBadge } from '@/components/status-badge';

interface ProjectsListProps {
  clientId: number;
  projects: Project[];
}

export function ProjectsList({ clientId, projects }: ProjectsListProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Projects</h3>
        <Link
          href={`/clients/${clientId}/projects/new`}
          className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          + Add Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <p className="text-gray-500 text-sm">No projects yet.</p>
      ) : (
        <div className="space-y-2">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/clients/${clientId}/projects/${project.id}`}
              className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors"
            >
              <span className="text-white font-medium">{project.name}</span>
              <StatusBadge status={project.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
