import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getInvoiceById } from '@/lib/queries/invoice-queries';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const invoice = getInvoiceById(db, Number(id));

  if (!invoice) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const html = generateInvoiceHtml(invoice);

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
      'Content-Disposition': `inline; filename="${invoice.invoice_number}.html"`,
    },
  });
}

function generateInvoiceHtml(invoice: NonNullable<ReturnType<typeof getInvoiceById>>) {
  const itemRows = invoice.items.map(item => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${item.description}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">$${item.unit_price.toLocaleString()}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">$${item.amount.toLocaleString()}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <title>${invoice.invoice_number}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #333; }
    @media print { body { margin: 0; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom:20px;">
    <button onclick="window.print()" style="padding:8px 16px;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;">Print / Save as PDF</button>
  </div>

  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;">
    <div>
      <h1 style="margin:0;font-size:28px;">INVOICE</h1>
      <p style="margin:4px 0;color:#666;">${invoice.invoice_number}</p>
    </div>
    <div style="text-align:right;">
      <p style="margin:0;font-weight:600;">CommandPost</p>
      <p style="margin:2px 0;color:#666;font-size:14px;">Generated ${new Date().toLocaleDateString()}</p>
    </div>
  </div>

  <div style="display:flex;justify-content:space-between;margin-bottom:30px;">
    <div>
      <p style="margin:0;font-size:12px;color:#666;text-transform:uppercase;">Bill To</p>
      <p style="margin:4px 0;font-weight:600;">${invoice.client_name}</p>
    </div>
    <div style="text-align:right;">
      <p style="margin:0;font-size:12px;color:#666;">Due: <strong>${invoice.due_date}</strong></p>
      <p style="margin:4px 0;font-size:12px;color:#666;">Status: <strong>${invoice.status}</strong></p>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <thead>
      <tr style="background:#f8f9fa;">
        <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #dee2e6;">Description</th>
        <th style="padding:10px 12px;text-align:center;border-bottom:2px solid #dee2e6;">Qty</th>
        <th style="padding:10px 12px;text-align:right;border-bottom:2px solid #dee2e6;">Unit Price</th>
        <th style="padding:10px 12px;text-align:right;border-bottom:2px solid #dee2e6;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div style="text-align:right;margin-top:20px;">
    <p style="font-size:20px;font-weight:700;">Total: $${invoice.total_amount.toLocaleString()}</p>
  </div>

  ${invoice.notes ? `<div style="margin-top:30px;padding:12px;background:#f8f9fa;border-radius:6px;font-size:14px;"><strong>Notes:</strong> ${invoice.notes}</div>` : ''}

  ${invoice.stripe_payment_link ? `<div style="margin-top:20px;text-align:center;"><a href="${invoice.stripe_payment_link}" style="display:inline-block;padding:12px 24px;background:#635bff;color:white;text-decoration:none;border-radius:6px;font-weight:600;">Pay Online</a></div>` : ''}
</body>
</html>`;
}
