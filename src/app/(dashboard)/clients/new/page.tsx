import Link from 'next/link';
import { ClientForm } from '@/components/client-form';
import { createClientAction } from '@/lib/actions/client-actions';

export default function NewClientPage() {
  return (
    <div className="p-4 sm:p-6 bg-gray-950 min-h-screen">
      <Link
        href="/clients"
        className="text-gray-400 hover:text-white text-sm transition-colors"
      >
        &larr; Back to Clients
      </Link>
      <h2 className="text-2xl font-bold text-white mt-4 mb-6">New Client</h2>
      <div className="max-w-2xl">
        <ClientForm action={createClientAction} submitLabel="Create Client" />
      </div>
    </div>
  );
}
