import Link from 'next/link';
import { getDb } from '@/lib/db';
import { listTemplates, getTemplateDeliverables } from '@/lib/queries/template-queries';
import { deleteTemplateAction } from '@/lib/actions/template-actions';

export const dynamic = 'force-dynamic';

export default function TemplatesPage() {
  const db = getDb();
  const templates = listTemplates(db);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Project Templates</h1>
        <Link href="/templates/new" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors">
          New Template
        </Link>
      </div>

      {templates.length === 0 ? (
        <p className="text-gray-500 text-sm">No templates yet. Create one to speed up project setup.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => {
            const deliverables = getTemplateDeliverables(db, t.id);
            return (
              <div key={t.id} className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-white font-medium">{t.name}</h3>
                  <form action={deleteTemplateAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <button type="submit" className="text-xs text-red-400 hover:text-red-300">Delete</button>
                  </form>
                </div>
                {t.description && <p className="text-sm text-gray-400 mb-3">{t.description}</p>}
                {t.hourly_rate && <p className="text-xs text-gray-500 mb-2">${t.hourly_rate}/hr</p>}
                <div className="border-t border-gray-800 pt-2 mt-2">
                  <p className="text-xs text-gray-500 mb-1">{deliverables.length} deliverable{deliverables.length !== 1 ? 's' : ''}</p>
                  <ul className="space-y-0.5">
                    {deliverables.slice(0, 5).map((d) => (
                      <li key={d.id} className="text-xs text-gray-400">
                        {d.title} <span className="text-gray-600">+{d.days_offset}d</span>
                      </li>
                    ))}
                    {deliverables.length > 5 && (
                      <li className="text-xs text-gray-600">+{deliverables.length - 5} more</li>
                    )}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
