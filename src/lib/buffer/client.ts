const BUFFER_ENDPOINT = 'https://api.buffer.com';

export class BufferError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = 'BufferError';
  }
}

export function isBufferConfigured(): boolean {
  return Boolean(process.env.BUFFER_API_KEY && process.env.BUFFER_ORG_ID);
}

export function bufferOrgId(): string {
  const id = process.env.BUFFER_ORG_ID;
  if (!id) throw new BufferError('BUFFER_ORG_ID is not set');
  return id;
}

export async function bufferGql<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const key = process.env.BUFFER_API_KEY;
  if (!key) throw new BufferError('BUFFER_API_KEY is not set');

  const res = await fetch(BUFFER_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    if (res.status === 401) throw new BufferError('Buffer key invalid/expired — check Settings', '401');
    throw new BufferError(`Buffer HTTP ${res.status}`, String(res.status));
  }

  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors?.length) {
    throw new BufferError(json.errors.map((e) => e.message).join('; '));
  }
  if (!json.data) throw new BufferError('Buffer returned no data');
  return json.data;
}
