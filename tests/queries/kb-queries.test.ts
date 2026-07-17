import { describe, it, expect, beforeEach } from 'vitest';
import { initDb } from '@/lib/db';
import {
  createKbDocument,
  getKbDocument,
  listKbDocuments,
  listAudibleKbDocuments,
  replaceChunks,
  chunksForDocuments,
  chunksForDocumentsExcludingAudible,
} from '@/lib/queries/kb-queries';
import { AUDIBLE_DOC_SET } from '@/lib/audible';
import type Database from 'better-sqlite3';

let db: Database.Database;
beforeEach(() => { db = initDb(':memory:'); });

function mkDoc(title: string, doc_set?: string | null) {
  return createKbDocument(db, {
    title,
    source_type: 'text',
    content: `content of ${title}`,
    ...(doc_set !== undefined ? { doc_set } : {}),
  });
}

describe('kb_documents doc_set fence', () => {
  it('migration adds doc_set column, NULL when not provided', () => {
    const col = db
      .prepare("SELECT COUNT(*) as count FROM pragma_table_info('kb_documents') WHERE name = 'doc_set'")
      .get() as { count: number };
    expect(col.count).toBe(1);
    const id = mkDoc('plain doc');
    expect(getKbDocument(db, id)!.doc_set).toBeNull();
  });

  it('createKbDocument round-trips doc_set audible', () => {
    const id = mkDoc('Audible — Influence', AUDIBLE_DOC_SET);
    expect(getKbDocument(db, id)!.doc_set).toBe('audible');
  });

  it('listAudibleKbDocuments returns only doc_set=audible; listKbDocuments excludes them (fence keys on column, not title)', () => {
    const general = mkDoc('general doc');
    // hand-titled impostor with NULL doc_set must stay on the general side
    const impostor = mkDoc('Audible — impostor');
    const audible = mkDoc('Audible — real', AUDIBLE_DOC_SET);

    const audibleIds = listAudibleKbDocuments(db).map((d) => d.id);
    expect(audibleIds).toEqual([audible]);

    const generalIds = listKbDocuments(db).map((d) => d.id).sort();
    expect(generalIds).toEqual([general, impostor].sort());
  });

  it('listKbDocuments search path also excludes audible docs', () => {
    mkDoc('Audible — real', AUDIBLE_DOC_SET);
    const impostor = mkDoc('Audible — impostor');
    const found = listKbDocuments(db, 'Audible').map((d) => d.id);
    expect(found).toEqual([impostor]);
  });
});

describe('chunks doc_set fence', () => {
  it('chunksForDocumentsExcludingAudible drops audible-doc chunks; chunksForDocuments unchanged', () => {
    const general = mkDoc('general doc');
    const audible = mkDoc('Audible — real', AUDIBLE_DOC_SET);
    replaceChunks(db, general, ['g1', 'g2']);
    replaceChunks(db, audible, ['a1']);

    const all = chunksForDocuments(db);
    expect(all.map((c) => c.text).sort()).toEqual(['a1', 'g1', 'g2']);

    const fenced = chunksForDocumentsExcludingAudible(db);
    expect(fenced.map((c) => c.text).sort()).toEqual(['g1', 'g2']);
    expect(fenced.every((c) => c.kb_document_id === general)).toBe(true);
  });
});
