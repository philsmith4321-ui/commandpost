import pdf from 'pdf-parse';

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
  '&apos;': "'", '&nbsp;': ' ', '&mdash;': '—', '&ndash;': '–', '&hellip;': '…',
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&[a-z]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m);
}

/** Strip HTML to readable text: drop scripts/styles/nav, remove tags, collapse whitespace. */
export function htmlToText(html: string): string {
  let s = html;
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<(script|style|noscript|svg|head|nav|footer|form)\b[\s\S]*?<\/\1>/gi, ' ');
  s = s.replace(/<\/(p|div|section|article|h[1-6]|li|tr|br|blockquote)>/gi, '\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  s = s.replace(/[ \t\f\v]+/g, ' ');
  s = s.replace(/\n\s*\n\s*\n+/g, '\n\n');
  return s.trim();
}

export function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (m) return decodeEntities(m[1].replace(/\s+/g, ' ').trim()) || null;
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return decodeEntities(htmlToText(h1[1])) || null;
  return null;
}

/** Fetch a URL and extract its readable text + title. */
export async function fetchWebsite(url: string): Promise<{ title: string; content: string }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('URL must start with http:// or https://');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  let res: Response;
  try {
    res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CommandPostBot/1.0)' },
    });
  } catch {
    throw new Error('Could not reach that URL');
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) throw new Error(`Fetch failed (HTTP ${res.status})`);
  const html = await res.text();
  const content = htmlToText(html);
  const title = extractTitle(html) || parsed.hostname + parsed.pathname;
  if (!content) throw new Error('No readable text found at that URL');
  return { title, content };
}

/** Extract text from a PDF buffer. */
export async function pdfToText(buffer: Buffer): Promise<string> {
  const data = await pdf(buffer);
  return (data.text || '').replace(/\n{3,}/g, '\n\n').trim();
}
