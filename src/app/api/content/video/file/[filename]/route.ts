import { NextRequest, NextResponse } from 'next/server';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { Readable } from 'stream';
import path from 'path';
import { UPLOAD_DIR, mimeForFile } from '@/lib/media/paths';

/** Serve uploaded media + cut clips, with HTTP Range support for in-browser playback. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  const safe = path.basename(filename); // prevent path traversal
  const filePath = path.join(UPLOAD_DIR, safe);

  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }

  const size = fileStat.size;
  const contentType = mimeForFile(safe);
  const range = request.headers.get('range');

  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    let start = match && match[1] ? parseInt(match[1], 10) : 0;
    let end = match && match[2] ? parseInt(match[2], 10) : size - 1;
    if (Number.isNaN(start)) start = 0;
    if (Number.isNaN(end) || end >= size) end = size - 1;
    if (start > end || start >= size) {
      return new NextResponse('Range Not Satisfiable', {
        status: 416,
        headers: { 'Content-Range': `bytes */${size}` },
      });
    }

    const stream = createReadStream(filePath, { start, end });
    const webStream = Readable.toWeb(stream) as unknown as ReadableStream;
    return new NextResponse(webStream, {
      status: 206,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(end - start + 1),
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=86400',
      },
    });
  }

  const stream = createReadStream(filePath);
  const webStream = Readable.toWeb(stream) as unknown as ReadableStream;
  return new NextResponse(webStream, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(size),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=86400',
    },
  });
}
