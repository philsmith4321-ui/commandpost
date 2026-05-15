import type { Lead } from '@/lib/types';

interface LeadFormProps {
  action: (formData: FormData) => void;
  lead?: Lead;
  submitLabel: string;
}

export function LeadForm({ action, lead, submitLabel }: LeadFormProps) {
  return (
    <form action={action} className="space-y-4 max-w-lg">
      {lead && <input type="hidden" name="id" value={lead.id} />}

      <div>
        <label className="block text-sm text-gray-400 mb-1">Business Name *</label>
        <input type="text" name="business_name" required defaultValue={lead?.business_name}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Contact Person</label>
          <input type="text" name="contact_person" defaultValue={lead?.contact_person ?? ''}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Email</label>
          <input type="email" name="email" defaultValue={lead?.email ?? ''}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Phone</label>
          <input type="tel" name="phone" defaultValue={lead?.phone ?? ''}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Website</label>
          <input type="text" name="website" defaultValue={lead?.website ?? ''}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Source</label>
          <select name="source" defaultValue={lead?.source ?? 'other'}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500">
            <option value="referral">Referral</option>
            <option value="website">Website</option>
            <option value="outbound">Outbound</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Est. Value ($)</label>
          <input type="number" name="estimated_value" step="0.01" defaultValue={lead?.estimated_value ?? ''}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Follow-up Date</label>
          <input type="date" name="follow_up_date" defaultValue={lead?.follow_up_date ?? ''}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500" />
        </div>
      </div>

      <button type="submit"
        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
        {submitLabel}
      </button>
    </form>
  );
}
