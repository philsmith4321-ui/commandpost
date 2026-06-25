import Link from 'next/link';
import { getDb } from '@/lib/db';

interface ContactRow {
  id: number;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  status: string;
}

interface Contact {
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  type: 'client' | 'lead';
  status: string;
  link: string;
}

export const dynamic = 'force-dynamic';

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const db = getDb();

  const clients = db.prepare(
    "SELECT id, name, contact_person, email, phone, status FROM clients WHERE deleted_at IS NULL ORDER BY name"
  ).all() as ContactRow[];

  const leads = db.prepare(
    "SELECT id, business_name as name, contact_person, email, phone, stage as status FROM leads WHERE stage NOT IN ('won','lost') ORDER BY business_name"
  ).all() as ContactRow[];

  let contacts: Contact[] = [
    ...clients.map(c => ({ ...c, type: 'client' as const, link: `/clients/${c.id}` })),
    ...leads.map(l => ({ ...l, type: 'lead' as const, link: `/pipeline/${l.id}` })),
  ];

  if (q) {
    const lower = q.toLowerCase();
    contacts = contacts.filter(c =>
      c.name.toLowerCase().includes(lower) ||
      (c.contact_person || '').toLowerCase().includes(lower) ||
      (c.email || '').toLowerCase().includes(lower)
    );
  }

  contacts.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="p-4 sm:p-6">
      <h2 className="text-2xl font-bold mb-6">Contacts</h2>

      <form className="mb-6">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search contacts..."
          className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500"
        />
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left text-gray-500">
              <th className="pb-3 font-medium">Name</th>
              <th className="pb-3 font-medium">Contact</th>
              <th className="pb-3 font-medium">Email</th>
              <th className="pb-3 font-medium">Phone</th>
              <th className="pb-3 font-medium">Type</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c, i) => (
              <tr key={`${c.type}-${i}`} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                <td className="py-3">
                  <Link href={c.link} className="text-blue-400 hover:underline">{c.name}</Link>
                </td>
                <td className="py-3 text-white">{c.contact_person || '—'}</td>
                <td className="py-3">
                  {c.email ? <a href={`mailto:${c.email}`} className="text-gray-300 hover:text-white">{c.email}</a> : '—'}
                </td>
                <td className="py-3 text-gray-400">{c.phone || '—'}</td>
                <td className="py-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${c.type === 'client' ? 'bg-blue-900/30 text-blue-400' : 'bg-purple-900/30 text-purple-400'}`}>
                    {c.type}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {contacts.length === 0 && (
        <p className="text-gray-500 mt-4">No contacts found.</p>
      )}
    </div>
  );
}
