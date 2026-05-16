import { quickAddNoteAction } from '@/lib/actions/dashboard-actions';

interface Client {
  id: number;
  name: string;
}

export function QuickNoteForm({ clients }: { clients: Client[] }) {
  return (
    <form action={quickAddNoteAction} className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
      <h3 className="text-sm font-medium text-gray-400 mb-3">Quick Note</h3>
      <div className="flex gap-2">
        <select name="client_id" required className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm min-w-32">
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input
          type="text"
          name="content"
          required
          placeholder="Add a quick note..."
          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
        />
        <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors">
          Add
        </button>
      </div>
    </form>
  );
}
