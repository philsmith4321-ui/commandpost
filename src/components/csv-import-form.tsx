'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

const importTypes = [
  { value: 'clients', label: 'Clients', fields: 'name, contact_person, email, phone, notes, source, status, monthly_value' },
  { value: 'expenses', label: 'Expenses', fields: 'description, amount, category, expense_date' },
  { value: 'leads', label: 'Leads', fields: 'business_name, contact_person, email, phone, website, source, estimated_value, stage' },
];

export function CsvImportForm() {
  const [result, setResult] = useState<{ ok?: boolean; imported?: number; error?: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [selectedType, setSelectedType] = useState('clients');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await fetch('/api/import', { method: 'POST', body: fd });
      const data = await res.json();
      setResult(data);
      if (data.ok) router.refresh();
    });
  };

  const selected = importTypes.find(t => t.value === selectedType);

  return (
    <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
      <h3 className="text-white font-medium mb-3">Import CSV</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <select name="type" value={selectedType} onChange={e => setSelectedType(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm w-full">
            {importTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          {selected && (
            <p className="text-xs text-gray-500 mt-1">Expected columns: {selected.fields}</p>
          )}
        </div>
        <input type="file" name="file" accept=".csv" required
          className="block w-full text-sm text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gray-800 file:text-white file:text-sm hover:file:bg-gray-700" />
        <button type="submit" disabled={isPending}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg disabled:opacity-50">
          {isPending ? 'Importing...' : 'Import'}
        </button>
      </form>

      {result && (
        <div className={`mt-3 p-3 rounded-lg text-sm ${result.ok ? 'bg-green-900/20 border border-green-800 text-green-400' : 'bg-red-900/20 border border-red-800 text-red-400'}`}>
          {result.ok ? `Successfully imported ${result.imported} records.` : `Error: ${result.error}`}
        </div>
      )}
    </div>
  );
}
