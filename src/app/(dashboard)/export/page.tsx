import Link from 'next/link';
import { CsvImportForm } from '@/components/csv-import-form';

const exports = [
  { type: 'clients', label: 'Clients', description: 'All active clients with contact info and monthly value' },
  { type: 'invoices', label: 'Invoices', description: 'All invoices with status, amounts, and dates' },
  { type: 'time', label: 'Time Entries', description: 'All time entries with rates and invoice status' },
  { type: 'expenses', label: 'Expenses', description: 'All expenses by category and date' },
  { type: 'leads', label: 'Leads', description: 'All pipeline leads with stage and contact info' },
];

export default function ExportPage() {
  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-bold mb-6">Import / Export Data</h1>
      <p className="text-gray-400 text-sm mb-6">Download your data as CSV files or import data from CSV.</p>

      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Import</h2>
        <CsvImportForm />
      </div>

      <h2 className="text-lg font-semibold mb-4">Export</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {exports.map(e => (
          <div key={e.type} className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
            <h3 className="text-white font-medium mb-1">{e.label}</h3>
            <p className="text-xs text-gray-400 mb-3">{e.description}</p>
            <a
              href={`/api/export?type=${e.type}`}
              download
              className="inline-block px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors"
            >
              Download CSV
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
