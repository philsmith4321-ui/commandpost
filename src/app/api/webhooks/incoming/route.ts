import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { createNotification } from '@/lib/notifications';

export async function POST(request: Request) {
  const secret = process.env.WEBHOOK_SECRET;
  if (secret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { type, title, message, link } = body;

  if (!type || !title) {
    return NextResponse.json({ error: 'type and title required' }, { status: 400 });
  }

  const db = getDb();
  await createNotification(db, {
    type: type || 'webhook',
    title,
    message: message || null,
    link: link || null,
  });

  return NextResponse.json({ received: true });
}
