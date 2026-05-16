import type Database from 'better-sqlite3';

export function logAudit(db: Database.Database, entityType: string, entityId: number, action: string, details?: string) {
  db.prepare('INSERT INTO audit_log (entity_type, entity_id, action, details) VALUES (?, ?, ?, ?)').run(entityType, entityId, action, details || null);
}

export interface AuditEntry {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  details: string | null;
  created_at: string;
}

export function getAuditLog(db: Database.Database, limit = 100, entityType?: string): AuditEntry[] {
  if (entityType) {
    return db.prepare('SELECT * FROM audit_log WHERE entity_type = ? ORDER BY created_at DESC LIMIT ?').all(entityType, limit) as AuditEntry[];
  }
  return db.prepare('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?').all(limit) as AuditEntry[];
}

export function getEntityAudit(db: Database.Database, entityType: string, entityId: number): AuditEntry[] {
  return db.prepare('SELECT * FROM audit_log WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC').all(entityType, entityId) as AuditEntry[];
}
