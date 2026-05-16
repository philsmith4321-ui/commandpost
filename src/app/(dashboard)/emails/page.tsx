import { getDb } from '@/lib/db';
import { listEmailLog } from '@/lib/queries/email-log-queries';
import { logEmailAction } from '@/lib/actions/email-log-actions';
import { listClients } from '@/lib/queries/client-queries';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function EmailLogPage() {
  const db = getDb();
  const emails = listEmailLog(db);
  const clients = listClients(db).map(c => ({ id: c.id, name: c.name }));

  return (
    <div className="p-4 sm:p-6">
      <h2 className="text-2xl font-bold mb-6">Email Log</h2>

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
        <p className="text-gray-500">No emails logged yet.</p>
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
