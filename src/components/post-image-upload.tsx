'use client';

import { useState } from 'react';

export function PostImageUpload({
  value,
  onChange,
}: {
  value: string;
  onChange: (filename: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/content/image', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Upload failed');
      else onChange(data.filename);
    } catch {
      setError('Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-400 mb-1">Image</label>
      <input type="hidden" name="image_path" value={value} />
      {value ? (
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/content/image/${value}`}
            alt="Post image"
            className="h-24 w-24 object-cover rounded-lg border border-gray-700"
          />
          <button type="button" onClick={() => onChange('')} className="text-xs text-red-400 hover:text-red-300">
            Remove
          </button>
        </div>
      ) : (
        <label className="inline-block px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 rounded-lg cursor-pointer transition-colors">
          {uploading ? 'Uploading...' : 'Upload Image'}
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      )}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
