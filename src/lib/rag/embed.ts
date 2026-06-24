// Voyage AI embeddings client. Dormant (returns null) unless VOYAGE_API_KEY is set.

const MODEL = process.env.VOYAGE_MODEL || 'voyage-3-lite';
const ENDPOINT = 'https://api.voyageai.com/v1/embeddings';
const BATCH = 100;

export function isVoyageConfigured(): boolean {
  return !!process.env.VOYAGE_API_KEY;
}

async function embed(texts: string[], inputType: 'document' | 'query'): Promise<number[][] | null> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key || texts.length === 0) return null;

  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: batch, model: MODEL, input_type: inputType }),
    });
    if (!res.ok) {
      console.error(`Voyage API error (${res.status}): ${await res.text()}`);
      return null;
    }
    const data = await res.json();
    for (const row of data.data) out.push(row.embedding as number[]);
  }
  return out;
}

export function embedDocuments(texts: string[]): Promise<number[][] | null> {
  return embed(texts, 'document');
}

export async function embedQuery(text: string): Promise<number[] | null> {
  const r = await embed([text], 'query');
  return r ? r[0] : null;
}
