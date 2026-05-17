import { getDb } from '@/lib/db';
import { getAllSettings, SETTING_KEYS } from '@/lib/queries/settings-queries';
import { saveSettingsAction } from '@/lib/actions/settings-actions';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  const db = getDb();
  const settings = getAllSettings(db);

  return (
    <div className="p-4 sm:p-6 max-w-2xl">
      <h2 className="text-2xl font-bold mb-6">Settings</h2>

      <div className="flex gap-2 mb-6">
        <Link href="/settings/notifications" className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">Notification Preferences</Link>
        <Link href="/settings/system" className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">System & Backup</Link>
      </div>

      <form action={saveSettingsAction} className="space-y-4">
        {SETTING_KEYS.map(({ key, label, type }) => (
          <div key={key}>
            <label className="block text-sm text-gray-400 mb-1">{label}</label>
            <input
              name={key}
              type={type}
              defaultValue={settings[key] || ''}
              className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none"
            />
          </div>
        ))}
        <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium">Save Settings</button>
      </form>
    </div>
  );
}
