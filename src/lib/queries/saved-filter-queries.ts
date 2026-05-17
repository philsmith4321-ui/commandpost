import type Database from 'better-sqlite3';

export interface SavedFilter {
  id: number;
  name: string;
  page: string;
  params: string;
  created_at: string;
}

export function listSavedFilters(db: Database.Database, page: string): SavedFilter[] {
  return db.prepare("SELECT * FROM saved_filters WHERE page = ? ORDER BY name").all(page) as SavedFilter[];
}

export function createSavedFilter(db: Database.Database, input: { name: string; page: string; params: string }): number {
  const result = db.prepare("INSERT INTO saved_filters (name, page, params) VALUES (?, ?, ?)").run(input.name, input.page, input.params);
  return Number(result.lastInsertRowid);
}

export function deleteSavedFilter(db: Database.Database, id: number): void {
  db.prepare("DELETE FROM saved_filters WHERE id = ?").run(id);
}
