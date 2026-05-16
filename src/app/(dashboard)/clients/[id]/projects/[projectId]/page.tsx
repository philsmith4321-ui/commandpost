import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getClientById } from '@/lib/queries/client-queries';
import { getProjectById, listDeliverables } from '@/lib/queries/project-queries';
import { StatusBadge } from '@/components/status-badge';
import { DeliverableList } from '@/components/deliverable-list';
import { ActivityLog } from '@/components/activity-log';
import { DeleteProjectButton } from '@/components/delete-project-button';
import type { ActivityLog as ActivityLogType } from '@/lib/types';

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string; projectId: string }>;
}) {
  const { id, projectId } = await params;
  const db = getDb();
  const client = getClientById(db, Number(id));
  const project = getProjectById(db, Number(projectId));

  if (!client || !project) {
    notFound();
  }

  const deliverables = listDeliverables(db, project.id);

  const activities = db
    .prepare('SELECT * FROM activity_logs WHERE project_id = ? ORDER BY created_at DESC LIMIT 50')
    .all(project.id) as ActivityLogType[];

  const techDetails = [
    { label: 'Server IP', value: project.server_ip, mono: true },
    { label: 'Repo URL', value: project.repo_url, mono: true },
    { label: 'Deploy Command', value: project.deploy_command, mono: true },
    { label: 'Stack Notes', value: project.stack_notes, mono: false },
  ].filter((d) => d.value);

  return (
    <div className="p-4 sm:p-6 bg-gray-950 min-h-screen">
      <Link
        href={`/clients/${client.id}`}
        className="text-gray-400 hover:text-white text-sm transition-colors"
      >
        &larr; Back to {client.name}
      </Link>

      <div className="flex items-center gap-4 mt-4 mb-2">
        <h1 className="text-2xl font-bold text-white">{project.name}</h1>
        <StatusBadge status={project.status} />
        <Link
          href={`/clients/${client.id}/projects/${project.id}/edit`}
          className="ml-auto px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
        >
          Edit
        </Link>
      </div>
      <p className="text-gray-500 text-sm mb-6">{client.name}</p>

      {techDetails.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {techDetails.map((detail) => (
            <div
              key={detail.label}
              className={`p-4 bg-gray-900 border border-gray-800 rounded-lg ${
                detail.label === 'Deploy Command' || detail.label === 'Stack Notes'
                  ? 'md:col-span-2'
                  : ''
              }`}
            >
              <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">
                {detail.label}
              </p>
              <p
                className={`text-white text-sm whitespace-pre-wrap ${
                  detail.mono ? 'font-mono' : ''
                }`}
              >
                {detail.value}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mb-8">
        <DeliverableList
          clientId={client.id}
          projectId={project.id}
          deliverables={deliverables}
        />
      </div>

      <div className="mb-8">
        <ActivityLog
          clientId={client.id}
          projectId={project.id}
          activities={activities}
        />
      </div>

      <DeleteProjectButton projectId={project.id} clientId={client.id} />
    </div>
  );
}
