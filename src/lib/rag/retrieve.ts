import type Database from 'better-sqlite3';
import { chunksForDocuments, type ChunkWithSource } from '@/lib/queries/kb-queries';
import { isVoyageConfigured, embedQuery } from '@/lib/rag/embed';
import type { RetrievalMode } from '@/lib/types';

export interface RetrievedChunk {
  text: string;
  doc_title: string;
  source_type: string;
  score: number;
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  mode: RetrievalMode;
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'is', 'are',
  'be', 'this', 'that', 'it', 'as', 'at', 'by', 'from', 'how', 'what', 'why', 'about',
]);

function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]{3,}/g) || []).filter((t) => !STOPWORDS.has(t));
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function keywordScore(text: string, terms: string[]): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const t of terms) {
    let idx = lower.indexOf(t);
    while (idx !== -1) { score += 1; idx = lower.indexOf(t, idx + t.length); }
  }
  return score;
}

/**
 * Retrieve the most relevant chunks for a topic from the selected KB documents.
 * Uses Voyage vector search when configured and embeddings exist; otherwise
 * falls back to keyword scoring so the feature works with no API key.
 */
export async function retrieveContext(
  db: Database.Database,
  opts: { topic: string; sourceIds: number[]; k?: number }
): Promise<RetrievalResult> {
  const k = opts.k ?? 8;
  if (!opts.sourceIds || opts.sourceIds.length === 0) return { chunks: [], mode: 'none' };

  const all = chunksForDocuments(db, opts.sourceIds);
  if (all.length === 0) return { chunks: [], mode: 'none' };

  // Vector path
  if (isVoyageConfigured()) {
    const embedded = all.filter((c) => c.embedding);
    if (embedded.length > 0) {
      const qvec = await embedQuery(opts.topic);
      if (qvec) {
        const scored = embedded
          .map((c) => ({ c, score: cosine(qvec, JSON.parse(c.embedding as string) as number[]) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, k);
        return {
          chunks: scored.map(({ c, score }) => toRetrieved(c, score)),
          mode: 'vector',
        };
      }
    }
  }

  // Keyword fallback
  const terms = tokenize(opts.topic);
  const scored = all
    .map((c) => ({ c, score: terms.length ? keywordScore(c.text, terms) : 0 }))
    .sort((a, b) => b.score - a.score);
  // If nothing matched, take the first few chunks so there is still some grounding.
  const top = (terms.length && scored[0]?.score > 0 ? scored.filter((s) => s.score > 0) : scored).slice(0, k);
  return { chunks: top.map(({ c, score }) => toRetrieved(c, score)), mode: 'keyword' };
}

function toRetrieved(c: ChunkWithSource, score: number): RetrievedChunk {
  return { text: c.text, doc_title: c.doc_title, source_type: c.source_type, score };
}
