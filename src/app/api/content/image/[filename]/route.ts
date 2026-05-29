import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  const safe = path.basename(filename); // prevents path traversal

  try {
    const buffer = await readFile(path.join(UPLOAD_DIR, safe));
    const type = MIME[path.extname(safe).toLowerCase()] || 'application/octet-stream';
    return new NextResponse(new Uint8Array(buffer), {
      headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=86400' },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
