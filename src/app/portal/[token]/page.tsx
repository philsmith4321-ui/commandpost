import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import {
  getClientByPortalToken,
  getPortalProjects,
  getPortalInvoices,
  getPortalActivity,
} from '@/lib/queries/portal-queries';

export const dynamic = 'force-dynamic';

export default async function PortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = getDb();
  const client = getClientByPortalToken(db, token);

  if (!client) {
    notFound();
  }

  const projects = getPortalProjects(db, client.id);
  const invoices = getPortalInvoices(db, client.id);
  const activity = getPortalActivity(db, client.id);

  const statusIcon: Record<string, string> = {
    not_started: '○',
    in_progress: '◐',
    delivered: '●',
  };

  const statusColor: Record<string, string> = {
    not_started: 'text-gray-400',
    in_progress: 'text-blue-500',
    delivered: 'text-green-500',
  };

  const invoiceStatusColor: Record<string, string> = {
    sent: 'bg-yellow-100 text-yellow-800',
    paid: 'bg-green-100 text-green-800',
    draft: 'bg-gray-100 text-gray-600',
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">{client.name}</h1>

      {/* Projects */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Projects</h2>
        {projects.length === 0 ? (
          <p className="text-gray-500 text-sm">No active projects.</p>
        ) : (
          <div className="space-y-4">
            {projects.map((project) => {
              const delivered = project.deliverables.filter(d => d.status === 'delivered').length;
              const total = project.deliverables.length;
              const pct = total > 0 ? Math.round((delivered / total) * 100) : 0;

              return (
                <div key={project.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-900">{project.name}</h3>
                    <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">
                      {project.status}
                    </span>
                  </div>
                  {total > 0 && (
                    <>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                        <div
                          className="bg-green-500 h-2 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mb-3">{delivered}/{total} deliverables complete ({pct}%)</p>
                      <ul className="space-y-1">
                        {project.deliverables.map((d) => (
                          <li key={d.id} className="flex items-center gap-2 text-sm">
                            <span className={statusColor[d.status]}>{statusIcon[d.status]}</span>
                            <span className="text-gray-700">{d.title}</span>
                            {d.due_date && <span className="text-gray-400 text-xs ml-auto">Due {d.due_date}</span>}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Invoices */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Invoices</h2>
        {invoices.length === 0 ? (
          <p className="text-gray-500 text-sm">No invoices.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-2 font-medium">Invoice</th>
                  <th className="pb-2 font-medium">Amount</th>
                  <th className="pb-2 font-medium">Due Date</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-gray-100">
                    <td className="py-3 text-gray-900">{inv.invoice_number}</td>
                    <td className="py-3 text-gray-900">${inv.total_amount.toLocaleString()}</td>
                    <td className="py-3 text-gray-600">{inv.due_date}</td>
                    <td className="py-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${invoiceStatusColor[inv.status]}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3">
                      {inv.status === 'sent' && inv.stripe_payment_link && (
                        <a
                          href={inv.stripe_payment_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        >
                          Pay Now
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Activity Feed */}
      {activity.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Recent Activity</h2>
          <div className="space-y-2">
            {activity.map((item) => (
              <div key={item.id} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
                <span className="text-gray-400 text-xs mt-0.5">
                  {new Date(item.created_at + 'Z').toLocaleDateString()}
                </span>
                <div>
                  <p className="text-sm text-gray-900">{item.title}</p>
                  {item.message && <p className="text-xs text-gray-500">{item.message}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
