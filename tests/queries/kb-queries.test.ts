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
  listAudibleStories,
  storyThemeCounts,
  storyDocIdsByTheme,
  getAudibleStory,
  storyDocsForSearch,
  randomStory,
  deleteAudibleStories,
} from '@/lib/queries/kb-queries';
import { AUDIBLE_DOC_SET, AUDIBLE_STORY_TITLE_PREFIX } from '@/lib/audible';
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

describe('Audible story queries', () => {
  function mkStory(label: string, theme: string, content = `story of ${label}`) {
    return createKbDocument(db, {
      title: `${AUDIBLE_STORY_TITLE_PREFIX}${label}`,
      source_type: 'text',
      content,
      doc_set: AUDIBLE_DOC_SET,
      theme,
    });
  }

  it('story queries key on doc_set + title prefix, never the theme column alone', () => {
    const story = mkStory('The Old Truck', 'Cars, trucks & driving');
    // audible-set doc WITHOUT the story prefix (a theme synthesis) must not count as a story
    const themeDoc = mkDoc('Audible — Influence', AUDIBLE_DOC_SET);
    // story-prefixed title WITHOUT doc_set=audible (hand-pasted impostor) must not count either
    const impostor = mkDoc(`${AUDIBLE_STORY_TITLE_PREFIX}Impostor`);

    const ids = listAudibleStories(db).map((d) => d.id);
    expect(ids).toEqual([story]);
    expect(ids).not.toContain(themeDoc);
    expect(ids).not.toContain(impostor);
  });

  it('storyThemeCounts groups stories per theme', () => {
    mkStory('A', 'Marriage & Amy');
    mkStory('B', 'Marriage & Amy');
    mkStory('C', 'Humor & lighter moments');
    const counts = new Map(storyThemeCounts(db).map((r) => [r.theme, r.count]));
    expect(counts.get('Marriage & Amy')).toBe(2);
    expect(counts.get('Humor & lighter moments')).toBe(1);
  });

  it('storyDocIdsByTheme returns only that theme, ordered by id', () => {
    const a = mkStory('A', 'Marriage & Amy');
    mkStory('C', 'Humor & lighter moments');
    const b = mkStory('B', 'Marriage & Amy');
    expect(storyDocIdsByTheme(db, 'Marriage & Amy')).toEqual([a, b]);
    expect(storyDocIdsByTheme(db, 'Scripture & Bible stories')).toEqual([]);
  });

  it('getAudibleStory returns a story doc but never a non-story doc by id', () => {
    const story = mkStory('The Old Truck', 'Cars, trucks & driving');
    const themeDoc = mkDoc('Audible — Influence', AUDIBLE_DOC_SET);
    expect(getAudibleStory(db, story)!.content).toBe('story of The Old Truck');
    // the IS_STORY fence is what stops /api/audible/story/[id] serving arbitrary kb docs
    expect(getAudibleStory(db, themeDoc)).toBeUndefined();
  });

  it('storyDocsForSearch returns full content, optionally theme-scoped', () => {
    mkStory('A', 'Marriage & Amy');
    mkStory('B', 'Humor & lighter moments');
    expect(storyDocsForSearch(db, null).map((d) => d.content).sort()).toEqual(['story of A', 'story of B']);
    const scoped = storyDocsForSearch(db, 'Marriage & Amy');
    expect(scoped).toHaveLength(1);
    expect(scoped[0].theme).toBe('Marriage & Amy');
  });

  it('randomStory respects the theme scope and returns undefined when empty', () => {
    mkStory('A', 'Marriage & Amy');
    expect(randomStory(db, 'Marriage & Amy')!.theme).toBe('Marriage & Amy');
    expect(randomStory(db, 'Scripture & Bible stories')).toBeUndefined();
    expect(randomStory(db, null)!.title.startsWith(AUDIBLE_STORY_TITLE_PREFIX)).toBe(true);
  });

  it('deleteAudibleStories removes only story docs and cascades their chunks', () => {
    const story = mkStory('A', 'Marriage & Amy');
    const themeDoc = mkDoc('Audible — Influence', AUDIBLE_DOC_SET);
    const general = mkDoc('general doc');
    replaceChunks(db, story, ['s1', 's2']);
    replaceChunks(db, themeDoc, ['t1']);
    replaceChunks(db, general, ['g1']);

    const removed = deleteAudibleStories(db);
    expect(removed).toBe(1);

    const remainingDocs = db.prepare('SELECT id FROM kb_documents ORDER BY id').all() as { id: number }[];
    expect(remainingDocs.map((r) => r.id)).toEqual([themeDoc, general]);
    // FK ON DELETE CASCADE: the story's chunks are gone, everyone else's remain
    const chunkOwners = db.prepare('SELECT DISTINCT kb_document_id FROM kb_chunks ORDER BY kb_document_id').all() as { kb_document_id: number }[];
    expect(chunkOwners.map((r) => r.kb_document_id)).toEqual([themeDoc, general]);
  });
});

describe('kb_documents author column', () => {
  it('createKbDocument round-trips author; NULL when omitted', () => {
    const withAuthor = createKbDocument(db, {
      title: 'Audible Book — Deep Work',
      source_type: 'system',
      content: 'note body',
      doc_set: AUDIBLE_DOC_SET,
      author: 'Cal Newport',
    });
    const without = createKbDocument(db, {
      title: 'Audible Book — Anon',
      source_type: 'system',
      content: 'note body',
      doc_set: AUDIBLE_DOC_SET,
    });
    const docs = listAudibleKbDocuments(db);
    expect(docs.find((d) => d.id === withAuthor)?.author).toBe('Cal Newport');
    expect(docs.find((d) => d.id === without)?.author).toBeNull();
    expect(getKbDocument(db, withAuthor)?.author).toBe('Cal Newport');
  });
});
