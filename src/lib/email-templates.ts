interface DigestItem {
  title: string;
  message: string | null;
  link: string | null;
  type: string;
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://commandpost.rekindleleads.com';

function layout(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#111;color:#fff;padding:32px;margin:0;">
  <div style="max-width:600px;margin:0 auto;">
    <h1 style="font-size:20px;color:#fff;margin-bottom:24px;">CommandPost</h1>
    ${content}
    <p style="margin-top:32px;font-size:12px;color:#666;">
      <a href="${BASE_URL}" style="color:#3b82f6;">Open CommandPost</a>
    </p>
  </div>
</body>
</html>`;
}

export function buildAlertEmail(title: string, message: string | null, link: string | null): string {
  const linkHtml = link ? `<p><a href="${BASE_URL}${link}" style="color:#3b82f6;text-decoration:underline;">View in CommandPost</a></p>` : '';
  return layout(`
    <div style="background:#1f2937;border:1px solid #374151;border-radius:8px;padding:20px;">
      <h2 style="font-size:16px;color:#f87171;margin:0 0 8px 0;">${title}</h2>
      ${message ? `<p style="color:#d1d5db;margin:0 0 12px 0;">${message}</p>` : ''}
      ${linkHtml}
    </div>
  `);
}

export function buildDigestEmail(items: DigestItem[]): string {
  if (items.length === 0) return '';

  const grouped: Record<string, DigestItem[]> = {};
  for (const item of items) {
    const key = item.type.replace(/_/g, ' ');
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  }

  let sections = '';
  for (const [type, typeItems] of Object.entries(grouped)) {
    sections += `<h3 style="font-size:14px;color:#9ca3af;text-transform:uppercase;margin:20px 0 8px 0;">${type}</h3>`;
    for (const item of typeItems) {
      const linkHtml = item.link ? ` <a href="${BASE_URL}${item.link}" style="color:#3b82f6;font-size:12px;">View</a>` : '';
      sections += `<div style="background:#1f2937;border:1px solid #374151;border-radius:6px;padding:12px;margin-bottom:8px;">
        <p style="color:#fff;margin:0;font-size:14px;">${item.title}${linkHtml}</p>
        ${item.message ? `<p style="color:#9ca3af;margin:4px 0 0 0;font-size:13px;">${item.message}</p>` : ''}
      </div>`;
    }
  }

  return layout(`
    <h2 style="font-size:16px;color:#fff;margin:0 0 16px 0;">Daily Digest</h2>
    <p style="color:#9ca3af;font-size:13px;margin:0 0 16px 0;">${items.length} notification${items.length === 1 ? '' : 's'} from the last 24 hours</p>
    ${sections}
  `);
}
