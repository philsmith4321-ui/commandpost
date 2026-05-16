import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getDigestNotifications } from '@/lib/queries/notification-queries';
import { recordAlert } from '@/lib/queries/alert-queries';
import { sendEmail } from '@/lib/email';
import { buildDigestEmail } from '@/lib/email-templates';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const notifications = getDigestNotifications(db);

  if (notifications.length === 0) {
    return NextResponse.json({ ok: true, sent: false, reason: 'no items' });
  }

  const items = notifications.map(n => ({
    title: n.title,
    message: n.message,
    link: n.link,
    type: n.type,
  }));

  const html = buildDigestEmail(items);
  const to = process.env.NOTIFICATION_TO_EMAIL;

  if (!to) {
    return NextResponse.json({ ok: false, reason: 'NOTIFICATION_TO_EMAIL not set' });
  }

  const sent = await sendEmail({
    to,
    subject: `[CommandPost] Daily Digest — ${notifications.length} item${notifications.length === 1 ? '' : 's'}`,
    html,
  });

  if (sent) {
    recordAlert(db, {
      alert_type: 'morning_briefing',
      reference_id: null,
      message: `Daily digest sent with ${notifications.length} items`,
    });
  }

  return NextResponse.json({ ok: true, sent, items: notifications.length });
}
