'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface DocumentRow {
  id: number;
  original_name: string;
  mime_type: string;
  size: number;
  uploaded_at: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function DocumentUpload({ entityType, entityId, documents }: {
  entityType: string;
  entityId: number;
  documents: DocumentRow[];
}) {
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    form.append('entity_type', entityType);
    form.append('entity_id', String(entityId));
    await fetch('/api/documents', { method: 'POST', body: form });
    setUploading(false);
    e.target.value = '';
    router.refresh();
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this document?')) return;
    await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    router.refresh();
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-400 uppercase">Documents</h3>
        <label className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 rounded-lg cursor-pointer transition-colors">
          {uploading ? 'Uploading...' : 'Upload File'}
          <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>
      {documents.length === 0 ? (
        <p className="text-sm text-gray-500">No documents attached.</p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-900 border border-gray-800 rounded-lg">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-gray-500 text-lg">
                  {doc.mime_type.startsWith('image/') ? '🖼' : doc.mime_type.includes('pdf') ? '📄' : '📎'}
                </span>
                <div className="min-w-0">
                  <a href={`/api/documents/${doc.id}`} target="_blank" className="text-sm text-blue-400 hover:underline truncate block">
                    {doc.original_name}
                  </a>
                  <p className="text-xs text-gray-500">{formatSize(doc.size)} · {new Date(doc.uploaded_at + 'Z').toLocaleDateString()}</p>
                </div>
              </div>
              <button onClick={() => handleDelete(doc.id)} className="text-xs text-red-400 hover:text-red-300 ml-2 shrink-0">
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
