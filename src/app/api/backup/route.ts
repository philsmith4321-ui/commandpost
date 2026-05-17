import { NextResponse } from 'next/server';
import { readFile, writeFile, readdir } from 'fs/promises';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'commandpost.db');
const BACKUP_DIR = path.join(process.cwd(), 'data', 'backups');

export async function GET() {
  try {
    const buffer = await readFile(DB_PATH);
    const filename = `commandpost-backup-${new Date().toISOString().slice(0, 10)}.db`;
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to read database' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const { mkdir } = await import('fs/promises');
    await mkdir(BACKUP_DIR, { recursive: true });

    const buffer = await readFile(DB_PATH);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupPath = path.join(BACKUP_DIR, `commandpost-${timestamp}.db`);
    await writeFile(backupPath, buffer);

    // Keep only last 10 backups
    const files = await readdir(BACKUP_DIR);
    const backups = files.filter(f => f.endsWith('.db')).sort();
    if (backups.length > 10) {
      const { unlink } = await import('fs/promises');
      for (const old of backups.slice(0, backups.length - 10)) {
        await unlink(path.join(BACKUP_DIR, old));
      }
    }

    return NextResponse.json({ ok: true, file: backupPath, size: buffer.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
