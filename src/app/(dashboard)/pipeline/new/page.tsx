import Link from 'next/link';
import { LeadForm } from '@/components/lead-form';
import { createLeadAction } from '@/lib/actions/lead-actions';

export default function NewLeadPage() {
  return (
    <div className="p-6">
      <Link href="/pipeline" className="text-sm text-gray-400 hover:text-white mb-4 inline-block">
        &larr; Back to Pipeline
      </Link>
      <h2 className="text-2xl font-bold mb-6">New Lead</h2>
      <LeadForm action={createLeadAction} submitLabel="Create Lead" />
    </div>
  );
}
