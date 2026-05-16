import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { recordDiskReport, deleteOldDiskReports } from '@/lib/queries/disk-report-queries';
import { hasAlertBeenSentToday, recordAlert } from '@/lib/queries/alert-queries';
import { isTwilioConfigured, sendSms } from '@/lib/twilio';

export async function POST(request: NextRequest) {
  const apiKey = process.env.DISK_REPORT_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Disk reporting not configured' }, { status: 503 });
  }

  const key = request.nextUrl.searchParams.get('key');
  if (key !== apiKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { endpoint_name: string; disks: { mount: string; total_gb: number; used_gb: number; percent_used: number }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.endpoint_name || !Array.isArray(body.disks) || body.disks.length === 0) {
    return NextResponse.json({ error: 'Missing endpoint_name or disks' }, { status: 400 });
  }

  const db = getDb();

  const endpoint = db.prepare('SELECT id, name FROM endpoints WHERE name = ?').get(body.endpoint_name) as { id: number; name: string } | undefined;
  if (!endpoint) {
    return NextResponse.json({ error: `Endpoint not found: ${body.endpoint_name}` }, { status: 404 });
  }

  for (const disk of body.disks) {
    recordDiskReport(db, {
      endpoint_id: endpoint.id,
      mount_point: disk.mount,
      total_gb: disk.total_gb,
      used_gb: disk.used_gb,
      percent_used: disk.percent_used,
    });

    if (disk.percent_used >= 85 && isTwilioConfigured()) {
      if (!hasAlertBeenSentToday(db, 'disk_warning', endpoint.id)) {
        const message = `DISK WARNING: ${endpoint.name} ${disk.mount} at ${disk.percent_used.toFixed(1)}% (${disk.used_gb.toFixed(1)}GB / ${disk.total_gb.toFixed(1)}GB)`;
        const sent = await sendSms(message);
        if (sent) {
          recordAlert(db, { alert_type: 'disk_warning', reference_id: endpoint.id, message });
        }
      }
    }
  }

  deleteOldDiskReports(db);

  return NextResponse.json({ ok: true });
}
