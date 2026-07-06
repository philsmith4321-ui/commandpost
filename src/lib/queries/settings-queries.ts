import type Database from 'better-sqlite3';

// Values written outside the app (e.g. sqlite3 readfile() in an ops session) can
// land as BLOBs, which better-sqlite3 returns as Buffers.
function asText(value: string | Buffer | null | undefined): string | null {
  if (value == null) return null;
  return typeof value === 'string' ? value : value.toString('utf8');
}

export function getSetting(db: Database.Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string | Buffer } | undefined;
  return asText(row?.value);
}

export function setSetting(db: Database.Database, key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run(key, value);
}

export function getAllSettings(db: Database.Database): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM app_settings ORDER BY key').all() as { key: string; value: string | Buffer }[];
  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = asText(row.value) ?? '';
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
