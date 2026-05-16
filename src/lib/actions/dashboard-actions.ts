'use server';

import { getDb } from '@/lib/db';
import { isClaudeConfigured, askClaude } from '@/lib/claude';
import { revalidatePath } from 'next/cache';

const DB_SCHEMA = `Tables:
- clients (id, name, contact_person, email, phone, notes, source, status ['active','paused','completed'], monthly_value, created_at, updated_at, deleted_at)
- projects (id, client_id FK->clients, name, status ['active','on-hold','completed'], start_date, server_ip, repo_url, deploy_command, stack_notes, created_at, updated_at)
- deliverables (id, project_id FK->projects, title, status ['not_started','in_progress','delivered'], due_date, completed_at, created_at)
- activity_logs (id, client_id FK->clients, project_id FK->projects nullable, content, created_at)
- leads (id, business_name, contact_person, email, phone, website, source ['referral','website','outbound','other'], estimated_value, stage ['new','contacted','discovery','proposal','negotiating','won','lost'], lost_reason, follow_up_date, created_at, updated_at, converted_client_id FK->clients nullable)
- lead_stage_history (id, lead_id FK->leads, stage, entered_at)
- lead_notes (id, lead_id FK->leads, content, created_at)
- invoices (id, client_id FK->clients, invoice_number UNIQUE, status ['draft','sent','paid'], due_date, sent_at, paid_at, stripe_payment_link, stripe_payment_id, is_recurring, recurrence_day, total_amount, notes, created_at, updated_at)
- invoice_items (id, invoice_id FK->invoices, description, quantity, unit_price, amount)
- expenses (id, client_id FK->clients nullable, category ['servers','software','contractor','marketing','other'], description, amount, expense_date, created_at)
- endpoints (id, name, url, check_interval_seconds, slow_threshold_ms, is_active, created_at)
- health_checks (id, endpoint_id FK->endpoints, status_code, response_time_ms, is_healthy, checked_at)
- incidents (id, endpoint_id FK->endpoints, started_at, resolved_at, duration_seconds)

All dates are ISO 8601 text strings. Use date('now') for current date. Soft-deleted clients have deleted_at set — filter with deleted_at IS NULL.`;

const SQL_SYSTEM_PROMPT = `You are a SQL assistant for a business management app. Given a user's question, write a SQLite SELECT query to answer it. Return ONLY the SQL query, no explanation, no markdown fences.

${DB_SCHEMA}`;

const ANSWER_SYSTEM_PROMPT = `You are a helpful business assistant. Given a user's question and the database query results, provide a clear, concise answer. Use specific numbers. Keep it to 2-3 sentences.`;

function stripCodeFences(text: string): string {
  return text.replace(/^```(?:sql)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
}

function isReadOnly(sql: string): boolean {
  const upper = sql.toUpperCase();
  if (!upper.trimStart().startsWith('SELECT')) return false;
  const forbidden = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'REPLACE', 'ATTACH', 'DETACH'];
  for (const word of forbidden) {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(sql)) return false;
  }
  const statements = sql.split(';').filter(s => s.trim().length > 0);
  if (statements.length > 1) return false;
  return true;
}

export type QueryResult = { answer: string } | { error: string };

export async function askDashboardQuestion(
  _prevState: QueryResult | null,
  formData: FormData
): Promise<QueryResult> {
  const question = (formData.get('question') as string)?.trim();
  if (!question) return { error: 'Please enter a question.' };
  if (!isClaudeConfigured()) return { error: 'AI features not configured.' };

  // Step 1: Generate SQL
  const sqlResponse = await askClaude(SQL_SYSTEM_PROMPT, question);
  if (!sqlResponse) return { error: 'Failed to generate query. Please try again.' };

  const sql = stripCodeFences(sqlResponse);

  // Step 2: Validate
  if (!isReadOnly(sql)) {
    return { error: 'Generated query was not a safe read-only query. Please rephrase.' };
  }

  // Step 3: Execute
  const db = getDb();
  let results: unknown[];
  try {
    results = db.prepare(sql).all();
  } catch (err) {
    return { error: `Query failed: ${(err as Error).message}` };
  }

  // Step 4: Format answer
  const answerResponse = await askClaude(
    ANSWER_SYSTEM_PROMPT,
    `Question: ${question}\n\nQuery results: ${JSON.stringify(results).slice(0, 4000)}`
  );

  if (!answerResponse) return { error: 'Failed to format answer. Please try again.' };

  return { answer: answerResponse };
}

export async function togglePinClientAction(formData: FormData) {
  const db = getDb();
  const clientId = Number(formData.get('client_id'));
  const currentlyPinned = Number(formData.get('is_pinned'));
  db.prepare('UPDATE clients SET is_pinned = ? WHERE id = ?').run(currentlyPinned ? 0 : 1, clientId);
  revalidatePath('/');
  revalidatePath('/clients');
}

export async function quickAddNoteAction(formData: FormData) {
  const db = getDb();
  const clientId = Number(formData.get('client_id'));
  const content = formData.get('content') as string;
  if (!content?.trim()) return;
  db.prepare('INSERT INTO activity_logs (client_id, content) VALUES (?, ?)').run(clientId, content.trim());
  revalidatePath('/');
}
