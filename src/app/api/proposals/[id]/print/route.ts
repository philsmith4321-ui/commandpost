import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getProposalById, getProposalItems } from '@/lib/queries/proposal-queries';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const proposal = getProposalById(db, Number(id));
  if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const items = getProposalItems(db, Number(id));
  const recipient = proposal.client_name || proposal.lead_name || 'Client';

  const itemRows = items.map(item => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${item.description}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">$${item.unit_price.toLocaleString()}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">$${item.amount.toLocaleString()}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Proposal - ${proposal.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #333; }
    @media print { body { margin: 0; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom:20px;">
    <button onclick="window.print()" style="padding:8px 16px;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;">Print / Save as PDF</button>
  </div>

  <div style="margin-bottom:40px;">
    <h1 style="margin:0;font-size:28px;">PROPOSAL</h1>
    <p style="margin:4px 0;color:#666;">${proposal.title}</p>
  </div>

  <div style="display:flex;justify-content:space-between;margin-bottom:30px;">
    <div>
      <p style="margin:0;font-size:12px;color:#666;text-transform:uppercase;">Prepared For</p>
      <p style="margin:4px 0;font-weight:600;">${recipient}</p>
    </div>
    <div style="text-align:right;">
      <p style="margin:0;font-size:12px;color:#666;">Date: ${new Date(proposal.created_at + 'Z').toLocaleDateString()}</p>
      ${proposal.valid_until ? `<p style="margin:4px 0;font-size:12px;color:#666;">Valid Until: <strong>${proposal.valid_until}</strong></p>` : ''}
      <p style="margin:4px 0;font-size:12px;color:#666;">Status: <strong>${proposal.status}</strong></p>
    </div>
  </div>

  ${proposal.scope ? `<div style="margin-bottom:20px;"><h3 style="margin:0 0 8px;font-size:16px;">Scope</h3><p style="font-size:14px;line-height:1.6;white-space:pre-wrap;">${proposal.scope}</p></div>` : ''}
  ${proposal.timeline ? `<div style="margin-bottom:20px;"><h3 style="margin:0 0 8px;font-size:16px;">Timeline</h3><p style="font-size:14px;line-height:1.6;white-space:pre-wrap;">${proposal.timeline}</p></div>` : ''}

  ${items.length > 0 ? `
  <h3 style="margin:20px 0 10px;font-size:16px;">Pricing</h3>
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <thead>
      <tr style="background:#f8f9fa;">
        <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #dee2e6;">Item</th>
        <th style="padding:10px 12px;text-align:center;border-bottom:2px solid #dee2e6;">Qty</th>
        <th style="padding:10px 12px;text-align:right;border-bottom:2px solid #dee2e6;">Unit Price</th>
        <th style="padding:10px 12px;text-align:right;border-bottom:2px solid #dee2e6;">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div style="text-align:right;"><p style="font-size:20px;font-weight:700;">Total: $${proposal.total_amount.toLocaleString()}</p></div>
  ` : ''}
</body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}
