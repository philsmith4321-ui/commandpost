import type Database from 'better-sqlite3';

export function getSetting(db: Database.Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(db: Database.Database, key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run(key, value);
}

export function getAllSettings(db: Database.Database): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM app_settings ORDER BY key').all() as { key: string; value: string }[];
  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = row.value;
  return result;
}

export const SETTING_KEYS = [
  { key: 'business_name', label: 'Business Name', type: 'text' },
  { key: 'business_email', label: 'Business Email', type: 'email' },
  { key: 'business_phone', label: 'Business Phone', type: 'text' },
  { key: 'default_hourly_rate', label: 'Default Hourly Rate ($)', type: 'number' },
  { key: 'invoice_footer', label: 'Invoice Footer Note', type: 'text' },
  { key: 'payment_terms', label: 'Payment Terms (days)', type: 'number' },
  { key: 'email_from_name', label: 'Email From Name', type: 'text' },
  { key: 'email_signature', label: 'Email Signature', type: 'text' },
  { key: 'resend_api_key', label: 'Resend API Key', type: 'password' },
] as const;
