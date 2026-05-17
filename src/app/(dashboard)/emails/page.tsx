import { getDb } from '@/lib/db';
import { listEmailLog } from '@/lib/queries/email-log-queries';
import { logEmailAction } from '@/lib/actions/email-log-actions';
import { listClients } from '@/lib/queries/client-queries';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function EmailLogPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; type?: string }>;
}) {
  const params = await searchParams;
  const db = getDb();
  const allEmails = listEmailLog(db);
  const clients = listClients(db).map(c => ({ id: c.id, name: c.name }));

  // Filter
  let emails = allEmails;
  if (params.search) {
    const q = params.search.toLowerCase();
    emails = emails.filter(e =>
      e.subject.toLowerCase().includes(q) ||
      e.recipient_email.toLowerCase().includes(q) ||
      (e.client_name || '').toLowerCase().includes(q)
    );
  }
  if (params.type) {
    emails = emails.filter(e => e.email_type === params.type);
  }

  // Stats
  const typeSet = new Set(allEmails.map(e => e.email_type));
  const types = Array.from(typeSet).sort();
  const thisMonth = new Date().toISOString().slice(0, 7);
  const emailsThisMonth = allEmails.filter(e => e.sent_at.startsWith(thisMonth)).length;

  return (
    <div className="p-4 sm:p-6">
      <h2 className="text-2xl font-bold mb-6">Email Log</h2>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Total Emails</p>
          <p className="text-2xl font-bold text-white">{allEmails.length}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">This Month</p>
          <p className="text-2xl font-bold text-white">{emailsThisMonth}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Types</p>
          <p className="text-2xl font-bold text-white">{types.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <form method="GET" action="/emails" className="flex-1 min-w-[200px] max-w-sm">
          {params.type && <input type="hidden" name="type" value={params.type} />}
          <input
            type="text"
            name="search"
            defaultValue={params.search || ''}
            placeholder="Search emails..."
            className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:border-blue-500 outline-none"
          />
        </form>
        <div className="flex items-center gap-2">
          <Link href="/emails" className={`px-2 py-1 rounded text-xs ${!params.type ? 'bg-blue-600/20 text-blue-400' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>All</Link>
          {types.map(t => (
            <Link key={t} href={`/emails?type=${t}${params.search ? `&search=${params.search}` : ''}`}
              className={`px-2 py-1 rounded text-xs transition-colors ${params.type === t ? 'bg-blue-600/20 text-blue-400' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              {t}
            </Link>
          ))}
        </div>
      </div>

      {/* Log email form */}
      <form action={logEmailAction} className="mb-6 p-4 bg-gray-900 border border-gray-800 rounded-lg">
        <h3 className="text-sm font-medium mb-3">Log an Email</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select name="client_id" className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm">
            <option value="">No client</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input name="recipient_email" type="email" placeholder="Recipient email" required className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
          <select name="email_type" className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm">
            <option value="invoice">Invoice</option>
            <option value="reminder">Reminder</option>
            <option value="proposal">Proposal</option>
            <option value="follow_up">Follow Up</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="mt-3 flex gap-3">
          <input name="subject" placeholder="Subject line" required className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
          <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium">Log</button>
        </div>
      </form>

      {emails.length === 0 ? (
        <p className="text-gray-500">No emails found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-500">
                <th className="pb-3 font-medium">Date</th>
                <th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium">Recipient</th>
                <th className="pb-3 font-medium">Subject</th>
                <th className="pb-3 font-medium">Client</th>
              </tr>
            </thead>
            <tbody>
              {emails.map((email) => (
                <tr key={email.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                  <td className="py-3 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(email.sent_at + 'Z').toLocaleDateString()}
                  </td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-300">{email.email_type}</span>
                  </td>
                  <td className="py-3 text-white">{email.recipient_email}</td>
                  <td className="py-3 text-white">{email.subject}</td>
                  <td className="py-3">
                    {email.client_id && email.client_name ? (
                      <Link href={`/clients/${email.client_id}`} className="text-blue-400 hover:underline">{email.client_name}</Link>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
