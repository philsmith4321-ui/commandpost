import type Database from 'better-sqlite3';
import type { MasterProfile, MasterProfileInput, MasterObjection } from '@/lib/types';

function parseObjections(v: unknown): MasterObjection[] {
  if (typeof v !== 'string' || !v) return [];
  try {
    const a = JSON.parse(v);
    return Array.isArray(a)
      ? a.filter((o) => o && typeof o.objection === 'string').map((o) => ({ objection: String(o.objection), counter: String(o.counter ?? '') }))
      : [];
  } catch { return []; }
}

function parseStrings(v: unknown): string[] {
  if (typeof v !== 'string' || !v) return [];
  try { const a = JSON.parse(v); return Array.isArray(a) ? a.map(String) : []; } catch { return []; }
}

export function getMasterProfile(db: Database.Database): MasterProfile | null {
  const row = db.prepare('SELECT * FROM master_profile WHERE id = 1').get() as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: 1,
    identity: (row.identity as string) ?? null,
    wants: (row.wants as string) ?? null,
    burned_by: (row.burned_by as string) ?? null,
    buying_trigger: (row.buying_trigger as string) ?? null,
    tone: (row.tone as string) ?? null,
    objections: parseObjections(row.objections),
    trust_builders: parseStrings(row.trust_builders),
    updated_at: (row.updated_at as string) ?? '',
  };
}

export function upsertMasterProfile(db: Database.Database, input: MasterProfileInput): void {
  db.prepare(
    `INSERT INTO master_profile (id, identity, wants, burned_by, buying_trigger, tone, objections, trust_builders, updated_at)
     VALUES (1, @identity, @wants, @burned_by, @buying_trigger, @tone, @objections, @trust_builders, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       identity=@identity, wants=@wants, burned_by=@burned_by, buying_trigger=@buying_trigger,
       tone=@tone, objections=@objections, trust_builders=@trust_builders, updated_at=datetime('now')`
  ).run({
    identity: input.identity ?? null,
    wants: input.wants ?? null,
    burned_by: input.burned_by ?? null,
    buying_trigger: input.buying_trigger ?? null,
    tone: input.tone ?? null,
    objections: JSON.stringify(input.objections ?? []),
    trust_builders: JSON.stringify(input.trust_builders ?? []),
  });
}
