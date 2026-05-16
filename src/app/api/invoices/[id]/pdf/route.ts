import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { getDb } from '@/lib/db';
import { getInvoiceById } from '@/lib/queries/invoice-queries';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  subheader: { fontSize: 12, color: '#666', marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { color: '#666', fontSize: 9 },
  value: { fontSize: 10 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ddd', paddingBottom: 4, marginBottom: 4 },
  tableRow: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#eee' },
  colDesc: { flex: 3 },
  colQty: { flex: 1, textAlign: 'right' },
  colPrice: { flex: 1, textAlign: 'right' },
  colAmount: { flex: 1, textAlign: 'right' },
  totalRow: { flexDirection: 'row', marginTop: 8, paddingTop: 8, borderTopWidth: 2, borderTopColor: '#333' },
  totalLabel: { flex: 5, textAlign: 'right', fontWeight: 'bold', fontSize: 12 },
  totalValue: { flex: 1, textAlign: 'right', fontWeight: 'bold', fontSize: 12 },
  section: { marginBottom: 20 },
  footer: { marginTop: 30, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#ddd', fontSize: 9, color: '#666' },
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const invoice = getInvoiceById(db, Number(id));

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  const businessName = process.env.BUSINESS_NAME || 'Phil Smith';

  const doc = React.createElement(Document, null,
    React.createElement(Page, { size: 'A4', style: styles.page },
      // Header
      React.createElement(Text, { style: styles.header }, 'INVOICE'),
      React.createElement(Text, { style: styles.subheader }, invoice.invoice_number),

      // From / To
      React.createElement(View, { style: styles.section },
        React.createElement(View, { style: styles.row },
          React.createElement(View, null,
            React.createElement(Text, { style: styles.label }, 'FROM'),
            React.createElement(Text, { style: styles.value }, businessName),
          ),
          React.createElement(View, null,
            React.createElement(Text, { style: styles.label }, 'TO'),
            React.createElement(Text, { style: styles.value }, invoice.client_name),
          ),
        ),
      ),

      // Details
      React.createElement(View, { style: styles.section },
        React.createElement(View, { style: styles.row },
          React.createElement(View, null,
            React.createElement(Text, { style: styles.label }, 'STATUS'),
            React.createElement(Text, { style: styles.value }, invoice.is_overdue ? 'OVERDUE' : invoice.status.toUpperCase()),
          ),
          React.createElement(View, null,
            React.createElement(Text, { style: styles.label }, 'DUE DATE'),
            React.createElement(Text, { style: styles.value }, invoice.due_date),
          ),
        ),
      ),

      // Line Items Table
      React.createElement(View, { style: styles.section },
        React.createElement(View, { style: styles.tableHeader },
          React.createElement(Text, { style: styles.colDesc }, 'Description'),
          React.createElement(Text, { style: styles.colQty }, 'Qty'),
          React.createElement(Text, { style: styles.colPrice }, 'Price'),
          React.createElement(Text, { style: styles.colAmount }, 'Amount'),
        ),
        ...invoice.items.map((item, i) =>
          React.createElement(View, { key: i, style: styles.tableRow },
            React.createElement(Text, { style: styles.colDesc }, item.description),
            React.createElement(Text, { style: styles.colQty }, String(item.quantity)),
            React.createElement(Text, { style: styles.colPrice }, `$${item.unit_price.toLocaleString()}`),
            React.createElement(Text, { style: styles.colAmount }, `$${item.amount.toLocaleString()}`),
          )
        ),
        React.createElement(View, { style: styles.totalRow },
          React.createElement(Text, { style: styles.totalLabel }, 'Total'),
          React.createElement(Text, { style: styles.totalValue }, `$${invoice.total_amount.toLocaleString()}`),
        ),
      ),

      // Notes
      invoice.notes ? React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.label }, 'NOTES'),
        React.createElement(Text, { style: styles.value }, invoice.notes),
      ) : null,

      // Stripe link
      invoice.stripe_payment_link ? React.createElement(View, { style: styles.footer },
        React.createElement(Text, null, `Pay online: ${invoice.stripe_payment_link}`),
      ) : null,
    )
  );

  const buffer = await renderToBuffer(doc);

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoice.invoice_number}.pdf"`,
    },
  });
}
