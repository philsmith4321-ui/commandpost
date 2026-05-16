import type Database from 'better-sqlite3';

export interface ScratchpadNote {
  id: number;
  title: string;
  content: string;
  is_pinned: number;
  created_at: string;
  updated_at: string;
}

export function listNotes(db: Database.Database): ScratchpadNote[] {
  return db.prepare('SELECT * FROM scratchpad ORDER BY is_pinned DESC, updated_at DESC').all() as ScratchpadNote[];
}

export function getNoteById(db: Database.Database, id: number): ScratchpadNote | undefined {
  return db.prepare('SELECT * FROM scratchpad WHERE id = ?').get(id) as ScratchpadNote | undefined;
}

export function createNote(db: Database.Database, title: string, content: string): number {
  const result = db.prepare('INSERT INTO scratchpad (title, content) VALUES (?, ?)').run(title, content);
  return Number(result.lastInsertRowid);
}

export function updateNote(db: Database.Database, id: number, title: string, content: string): void {
  db.prepare("UPDATE scratchpad SET title = ?, content = ?, updated_at = datetime('now') WHERE id = ?").run(title, content, id);
}

export function deleteNote(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM scratchpad WHERE id = ?').run(id);
}

export function togglePinNote(db: Database.Database, id: number): void {
  db.prepare("UPDATE scratchpad SET is_pinned = CASE WHEN is_pinned = 1 THEN 0 ELSE 1 END, updated_at = datetime('now') WHERE id = ?").run(id);
}
