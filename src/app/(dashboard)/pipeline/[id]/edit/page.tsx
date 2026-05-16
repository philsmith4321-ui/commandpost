import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getLeadById } from '@/lib/queries/lead-queries';
import { LeadForm } from '@/components/lead-form';
import { updateLeadAction } from '@/lib/actions/lead-actions';

export default async function EditLeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const lead = getLeadById(db, Number(id));
  if (!lead) notFound();

  return (
    <div className="p-4 sm:p-6">
      <Link href={`/pipeline/${id}`} className="text-sm text-gray-400 hover:text-white mb-4 inline-block">
        &larr; Back to {lead.business_name}
      </Link>
      <h2 className="text-2xl font-bold mb-6">Edit Lead</h2>
      <LeadForm action={updateLeadAction} lead={lead} submitLabel="Save Changes" />
    </div>
  );
}
