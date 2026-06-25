import type Database from 'better-sqlite3';

export interface WebhookRow {
  id: number;
  name: string;
  url: string;
  events: string;
  secret: string | null;
  enabled: number;
  last_triggered: string | null;
  created_at: string;
}

export function listWebhooks(db: Database.Database): WebhookRow[] {
  return db.prepare('SELECT * FROM webhooks ORDER BY created_at DESC').all() as WebhookRow[];
}

export function createWebhook(db: Database.Database, input: {
  name: string; url: string; events: string; secret?: string | null;
}): number {
  const result = db.prepare(
    'INSERT INTO webhooks (name, url, events, secret) VALUES (?, ?, ?, ?)'
  ).run(input.name, input.url, input.events, input.secret ?? null);
  return Number(result.lastInsertRowid);
}

export function deleteWebhook(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM webhooks WHERE id = ?').run(id);
}

export function toggleWebhook(db: Database.Database, id: number): void {
  db.prepare('UPDATE webhooks SET enabled = CASE WHEN enabled = 1 THEN 0 ELSE 1 END WHERE id = ?').run(id);
}

export function getWebhooksForEvent(db: Database.Database, event: string): WebhookRow[] {
  return db.prepare("SELECT * FROM webhooks WHERE enabled = 1 AND (',' || events || ',') LIKE '%,' || ? || ',%'").all(event) as WebhookRow[];
}

export async function fireWebhooks(db: Database.Database, event: string, payload: Record<string, unknown>): Promise<void> {
  const hooks = getWebhooksForEvent(db, event);
  for (const hook of hooks) {
    try {
      await fetch(hook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(hook.secret ? { 'X-Webhook-Secret': hook.secret } : {}),
        },
        body: JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload }),
      });
      db.prepare("UPDATE webhooks SET last_triggered = datetime('now') WHERE id = ?").run(hook.id);
    } catch (err) {
      console.error(`[webhook] Failed to fire ${hook.name}:`, err);
    }
  }
}
