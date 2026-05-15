import type { Client } from '@/lib/types';

interface ClientFormProps {
  action: (formData: FormData) => Promise<void>;
  client?: Client;
  submitLabel: string;
}

export function ClientForm({ action, client, submitLabel }: ClientFormProps) {
  const inputClass =
    'w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500';

  return (
    <form action={action} className="space-y-6">
      {client && <input type="hidden" name="id" value={client.id} />}

      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">
          Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          name="name"
          required
          defaultValue={client?.name ?? ''}
          placeholder="Client or company name"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Contact Person
          </label>
          <input
            type="text"
            name="contact_person"
            defaultValue={client?.contact_person ?? ''}
            placeholder="Primary contact"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Email
          </label>
          <input
            type="email"
            name="email"
            defaultValue={client?.email ?? ''}
            placeholder="email@example.com"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Phone
          </label>
          <input
            type="tel"
            name="phone"
            defaultValue={client?.phone ?? ''}
            placeholder="(555) 123-4567"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Status
          </label>
          <select
            name="status"
            defaultValue={client?.status ?? 'active'}
            className={inputClass}
          >
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Monthly Value ($)
          </label>
          <input
            type="number"
            name="monthly_value"
            defaultValue={client?.monthly_value ?? ''}
            placeholder="0.00"
            step="0.01"
            min="0"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Source
          </label>
          <input
            type="text"
            name="source"
            defaultValue={client?.source ?? ''}
            placeholder="How did they find you?"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">
          Notes
        </label>
        <textarea
          name="notes"
          rows={4}
          defaultValue={client?.notes ?? ''}
          placeholder="Any additional notes..."
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
      >
        {submitLabel}
      </button>
    </form>
  );
}
