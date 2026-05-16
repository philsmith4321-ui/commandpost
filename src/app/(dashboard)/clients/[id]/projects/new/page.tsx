import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getClientById } from '@/lib/queries/client-queries';
import { createProjectAction } from '@/lib/actions/project-actions';
import { ProjectForm } from '@/components/project-form';

export default async function NewProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const client = getClientById(db, Number(id));

  if (!client) {
    notFound();
  }

  return (
    <div className="p-4 sm:p-6 bg-gray-950 min-h-screen">
      <Link
        href={`/clients/${client.id}`}
        className="text-gray-400 hover:text-white text-sm transition-colors"
      >
        &larr; Back to {client.name}
      </Link>
      <h2 className="text-2xl font-bold text-white mt-4 mb-6">New Project</h2>
      <div className="max-w-2xl">
        <ProjectForm
          action={createProjectAction}
          clientId={client.id}
          submitLabel="Create Project"
        />
      </div>
    </div>
  );
}
