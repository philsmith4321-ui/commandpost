import { NextResponse } from 'next/server';
import { isBufferConfigured, bufferOrgId, BufferError } from '@/lib/buffer/client';
import { listChannels } from '@/lib/buffer/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isBufferConfigured()) {
    return NextResponse.json({ configured: false, orgId: null, channels: [] });
  }
  try {
    const channels = await listChannels();
    return NextResponse.json({ configured: true, orgId: bufferOrgId(), channels });
  } catch (err) {
    const message = err instanceof BufferError ? err.message : 'Failed to reach Buffer';
    return NextResponse.json({ configured: true, orgId: bufferOrgId(), channels: [], error: message }, { status: 502 });
  }
}
