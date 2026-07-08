export function isClaudeConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function askClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 1024,
  model: string = 'claude-sonnet-4-20250514'
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Claude API error (${response.status}): ${text}`);
      return null;
    }

    const data = await response.json();
    return data.content[0].text;
  } catch (err) {
    console.error('Claude API request failed:', err);
    return null;
  }
}

// Like askClaude, but with the server-side web search tool enabled. The
// response interleaves text + search-result blocks; the LAST text block is
// the model's final answer after searching, so that's what we return.
export async function askClaudeWithWebSearch(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 1024,
  model: string = 'claude-sonnet-4-6',
  maxSearches: number = 5
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: maxSearches }],
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Claude web-search API error (${response.status}): ${text}`);
      return null;
    }

    const data = await response.json();
    const blocks: Array<{ type: string; text?: string }> = data.content ?? [];
    // The final answer is every text block AFTER the last tool block: with web
    // search the answer arrives split across many citation-bearing text blocks,
    // so taking only the last one keeps just a tail fragment (often a bare URL).
    // Text before/between tool calls is preamble ("I'll search for...") — skip it.
    const lastToolIdx = blocks.reduce((acc, b, i) => (b.type === 'text' ? acc : i), -1);
    const answer = blocks.slice(lastToolIdx + 1)
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text!)
      .join('')
      .trim();
    return answer || null;
  } catch (err) {
    console.error('Claude web-search request failed:', err);
    return null;
  }
}
