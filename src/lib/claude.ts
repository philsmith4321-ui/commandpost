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
