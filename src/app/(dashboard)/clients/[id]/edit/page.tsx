import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getClientById } from '@/lib/queries/client-queries';
import { updateClientAction } from '@/lib/actions/client-actions';
import { ClientForm } from '@/components/client-form';

export default async function EditClientPage({
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
    <div className="p-6 bg-gray-950 min-h-screen">
      <Link
        href={`/clients/${client.id}`}
        className="text-gray-400 hover:text-white text-sm transition-colors"
      >
        &larr; Back to {client.name}
      </Link>
      <h2 className="text-2xl font-bold text-white mt-4 mb-6">Edit Client</h2>
      <div className="max-w-2xl">
        <ClientForm
          action={updateClientAction}
          client={client}
          submitLabel="Save Changes"
        />
      </div>
    </div>
  );
}
