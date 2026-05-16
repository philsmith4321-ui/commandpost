'use client';

import { useState } from 'react';
import { addDocumentAction, deleteDocumentAction } from '@/lib/actions/document-actions';
import type { ClientDocument } from '@/lib/queries/document-queries';

export function ClientDocuments({ clientId, documents }: { clientId: number; documents: ClientDocument[] }) {
  const [showForm, setShowForm] = useState(false);
  const [docType, setDocType] = useState<'note' | 'link'>('note');

  return (
    <div className="bg-gray-800/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Documents & Notes</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded"
        >
          {showForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {showForm && (
        <form action={addDocumentAction} onSubmit={() => setShowForm(false)} className="mb-4 space-y-2 border border-gray-700 rounded p-3">
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="doc_type" value={docType} />

          <div className="flex gap-2 mb-2">
            <button type="button" onClick={() => setDocType('note')} className={`text-xs px-2 py-1 rounded ${docType === 'note' ? 'bg-blue-600' : 'bg-gray-700'}`}>Note</button>
            <button type="button" onClick={() => setDocType('link')} className={`text-xs px-2 py-1 rounded ${docType === 'link' ? 'bg-blue-600' : 'bg-gray-700'}`}>Link</button>
          </div>

          <input name="title" placeholder="Title" required className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm" />

          {docType === 'note' && (
            <textarea name="content" placeholder="Content..." rows={3} className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm" />
          )}

          {docType === 'link' && (
            <input name="url" type="url" placeholder="https://..." required className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm" />
          )}

          <button type="submit" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm">Save</button>
        </form>
      )}

      {documents.length === 0 ? (
        <p className="text-gray-500 text-sm">No documents yet.</p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-start justify-between gap-2 py-2 border-b border-gray-800 last:border-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">{doc.doc_type}</span>
                  {doc.url ? (
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-400 hover:underline truncate">{doc.title}</a>
                  ) : (
                    <span className="text-sm font-medium truncate">{doc.title}</span>
                  )}
                </div>
                {doc.content && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{doc.content}</p>}
                <p className="text-xs text-gray-600 mt-1">{new Date(doc.created_at + 'Z').toLocaleDateString()}</p>
              </div>
              <form action={deleteDocumentAction}>
                <input type="hidden" name="id" value={doc.id} />
                <input type="hidden" name="client_id" value={clientId} />
                <button type="submit" className="text-xs text-red-500 hover:text-red-400">×</button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
