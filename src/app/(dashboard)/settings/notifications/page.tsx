import { getDb } from '@/lib/db';
import { getNotificationPreferences } from '@/lib/queries/notification-queries';
import { updateNotificationPreferenceAction } from '@/lib/actions/notification-actions';

export const dynamic = 'force-dynamic';

export default function NotificationSettingsPage() {
  const db = getDb();
  const preferences = getNotificationPreferences(db);

  const typeLabels: Record<string, string> = {
    server_down: 'Server Down',
    server_recovered: 'Server Recovered',
    client_health_critical: 'Client Health Critical',
    invoice_overdue: 'Invoice Overdue',
    invoice_paid: 'Invoice Paid',
    deliverable_overdue: 'Deliverable Overdue',
    follow_up_due: 'Follow-up Due',
    lead_stage_changed: 'Lead Stage Changed',
    time_invoiced: 'Time Invoiced',
    proposal_accepted: 'Proposal Accepted',
    contract_expiring: 'Contract Expiring',
  };

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-bold mb-6">Notification Settings</h1>
      <p className="text-gray-400 text-sm mb-6">Configure how you receive email notifications for each event type.</p>

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-left">
              <th className="p-4">Event Type</th>
              <th className="p-4">Email Delivery</th>
            </tr>
          </thead>
          <tbody>
            {preferences.map((pref) => (
              <tr key={pref.notification_type} className="border-b border-gray-800/50">
                <td className="p-4 text-white">{typeLabels[pref.notification_type] || pref.notification_type}</td>
                <td className="p-4">
                  {pref.forced ? (
                    <span className="text-sm text-yellow-400">Immediate (required)</span>
                  ) : (
                    <form action={updateNotificationPreferenceAction} className="inline">
                      <input type="hidden" name="notification_type" value={pref.notification_type} />
                      <select
                        name="email_delivery"
                        defaultValue={pref.email_delivery}
                        className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
                      >
                        <option value="immediate">Immediate</option>
                        <option value="digest">Daily Digest</option>
                        <option value="none">None</option>
                      </select>
                      <button type="submit" className="ml-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs transition-colors">
                        Save
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
