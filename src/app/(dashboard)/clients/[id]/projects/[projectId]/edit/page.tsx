import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getClientById } from '@/lib/queries/client-queries';
import { getProjectById } from '@/lib/queries/project-queries';
import { updateProjectAction } from '@/lib/actions/project-actions';
import { ProjectForm } from '@/components/project-form';

export default async function EditProjectPage({
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

  return (
    <div className="p-4 sm:p-6 bg-gray-950 min-h-screen">
      <Link
        href={`/clients/${client.id}/projects/${project.id}`}
        className="text-gray-400 hover:text-white text-sm transition-colors"
      >
        &larr; Back to {project.name}
      </Link>
      <h2 className="text-2xl font-bold text-white mt-4 mb-6">Edit Project</h2>
      <div className="max-w-2xl">
        <ProjectForm
          action={updateProjectAction}
          clientId={client.id}
          project={project}
          submitLabel="Save Changes"
        />
      </div>
    </div>
  );
}
