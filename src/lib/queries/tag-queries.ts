import type Database from 'better-sqlite3';

export interface Tag {
  id: number;
  name: string;
  color: string;
}

export function listTags(db: Database.Database): Tag[] {
  return db.prepare('SELECT * FROM tags ORDER BY name').all() as Tag[];
}

export function getClientTags(db: Database.Database, clientId: number): Tag[] {
  return db.prepare(`
    SELECT t.* FROM tags t JOIN client_tags ct ON t.id = ct.tag_id WHERE ct.client_id = ?
    ORDER BY t.name
  `).all(clientId) as Tag[];
}

export function createTag(db: Database.Database, name: string, color: string): number {
  const result = db.prepare('INSERT OR IGNORE INTO tags (name, color) VALUES (?, ?)').run(name, color);
  if (result.changes === 0) {
    return (db.prepare('SELECT id FROM tags WHERE name = ?').get(name) as { id: number }).id;
  }
  return Number(result.lastInsertRowid);
}

export function addTagToClient(db: Database.Database, clientId: number, tagId: number): void {
  db.prepare('INSERT OR IGNORE INTO client_tags (client_id, tag_id) VALUES (?, ?)').run(clientId, tagId);
}

export function removeTagFromClient(db: Database.Database, clientId: number, tagId: number): void {
  db.prepare('DELETE FROM client_tags WHERE client_id = ? AND tag_id = ?').run(clientId, tagId);
}

export function deleteTag(db: Database.Database, tagId: number): void {
  db.prepare('DELETE FROM tags WHERE id = ?').run(tagId);
}

export function getClientsByTag(db: Database.Database, tagId: number): { id: number; name: string }[] {
  return db.prepare(`
    SELECT c.id, c.name FROM clients c JOIN client_tags ct ON c.id = ct.client_id
    WHERE ct.tag_id = ? AND c.deleted_at IS NULL ORDER BY c.name
  `).all(tagId) as { id: number; name: string }[];
}
