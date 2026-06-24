const TARGET = 1400; // ~chars per chunk
const MAX = 2000;

/** Split text into retrieval-sized chunks on paragraph/sentence boundaries. */
export function chunkText(content: string): string[] {
  const text = content.replace(/\r\n/g, '\n').trim();
  if (!text) return [];

  const paragraphs = text.split(/\n{2,}/).flatMap((p) => {
    if (p.length <= MAX) return [p.trim()];
    // Break overly long paragraphs on sentence boundaries.
    const sentences = p.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) || [p];
    return sentences.map((s) => s.trim());
  });

  const chunks: string[] = [];
  let buf = '';
  for (const p of paragraphs) {
    if (!p) continue;
    if (buf && (buf.length + p.length + 2) > TARGET) {
      chunks.push(buf.trim());
      buf = '';
    }
    buf = buf ? `${buf}\n\n${p}` : p;
    while (buf.length > MAX) {
      chunks.push(buf.slice(0, MAX).trim());
      buf = buf.slice(MAX);
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks.filter(Boolean);
}
