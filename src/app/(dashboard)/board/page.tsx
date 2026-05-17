import Link from 'next/link';
import { getDb } from '@/lib/db';
import { getAllActiveDeliverables } from '@/lib/queries/deliverable-queries';
import { updateDeliverableStatusAction } from '@/lib/actions/deliverable-actions';

export const dynamic = 'force-dynamic';

const columns = [
  { status: 'not_started', label: 'Not Started', color: 'border-gray-600' },
  { status: 'in_progress', label: 'In Progress', color: 'border-blue-600' },
  { status: 'delivered', label: 'Delivered', color: 'border-green-600' },
];

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const params = await searchParams;
  const db = getDb();
  let deliverables = getAllActiveDeliverables(db);

  // Client filter
  if (params.client) {
    deliverables = deliverables.filter(d => d.client_id === Number(params.client));
  }

  const today = new Date().toISOString().split('T')[0];

  const overdueCount = deliverables.filter(d => d.due_date && d.due_date < today && d.status !== 'delivered').length;
  const totalCount = deliverables.length;

  // Unique clients for filter
  const allDeliverables = getAllActiveDeliverables(db);
  const clientMap = new Map<number, string>();
  allDeliverables.forEach(d => clientMap.set(d.client_id, d.client_name));
  const clients = Array.from(clientMap.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Deliverables Board</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-400">{totalCount} items</span>
          {overdueCount > 0 && <span className="text-red-400">{overdueCount} overdue</span>}
        </div>
      </div>

      {/* Client filter */}
      {clients.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="text-xs text-gray-500">Filter:</span>
          <Link href="/board" className={`px-2 py-1 rounded text-xs ${!params.client ? 'bg-blue-600/20 text-blue-400' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>All</Link>
          {clients.map(c => (
            <Link key={c.id} href={`/board?client=${c.id}`}
              className={`px-2 py-1 rounded text-xs transition-colors ${String(c.id) === params.client ? 'bg-blue-600/20 text-blue-400' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              {c.name}
            </Link>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map(col => {
          const items = deliverables.filter(d => d.status === col.status);
          return (
            <div key={col.status} className={`border-t-2 ${col.color} bg-gray-900/50 rounded-lg p-4`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-gray-300">{col.label}</h2>
                <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map(d => {
                  const isOverdue = d.due_date && d.due_date < today && d.status !== 'delivered';
                  return (
                    <div key={d.id} className="p-3 bg-gray-900 border border-gray-800 rounded-lg">
                      <Link href={`/clients/${d.client_id}/projects/${d.project_id}`} className="text-sm text-white hover:text-blue-400 font-medium">
                        {d.title}
                      </Link>
                      <p className="text-xs text-gray-500 mt-1">{d.client_name} / {d.project_name}</p>
                      <div className="flex items-center justify-between mt-2">
                        {d.due_date ? (
                          <span className={`text-xs ${isOverdue ? 'text-red-400' : 'text-gray-500'}`}>
                            {isOverdue ? 'Overdue: ' : 'Due: '}{d.due_date}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-600">No due date</span>
                        )}
                        <form action={updateDeliverableStatusAction} className="inline">
                          <input type="hidden" name="id" value={d.id} />
                          {d.status === 'not_started' && (
                            <>
                              <input type="hidden" name="status" value="in_progress" />
                              <button type="submit" className="text-xs text-blue-400 hover:text-blue-300">Start →</button>
                            </>
                          )}
                          {d.status === 'in_progress' && (
                            <>
                              <input type="hidden" name="status" value="delivered" />
                              <button type="submit" className="text-xs text-green-400 hover:text-green-300">Done ✓</button>
                            </>
                          )}
                          {d.status === 'delivered' && (
                            <>
                              <input type="hidden" name="status" value="in_progress" />
                              <button type="submit" className="text-xs text-yellow-400 hover:text-yellow-300">Reopen</button>
                            </>
                          )}
                        </form>
                      </div>
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <p className="text-xs text-gray-600 text-center py-4">No items</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
