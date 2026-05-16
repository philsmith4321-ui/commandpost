import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { reportStyles as s } from './pdf-styles';
import type { ClientRevenueRow } from '@/lib/queries/report-queries';

export function buildClientRevenuePdf(data: ClientRevenueRow[], start: string, end: string) {
  const totalRevenue = data.reduce((sum, r) => sum + r.revenue, 0);
  const totalInvoices = data.reduce((sum, r) => sum + r.invoice_count, 0);

  return React.createElement(Document, null,
    React.createElement(Page, { size: 'A4', style: s.page },
      React.createElement(Text, { style: s.title }, 'Client Revenue Summary'),
      React.createElement(Text, { style: s.subtitle }, `${start} to ${end}`),

      React.createElement(View, { style: s.statBox },
        React.createElement(View, null,
          React.createElement(Text, { style: s.statLabel }, 'TOTAL REVENUE'),
          React.createElement(Text, { style: [s.statValue, s.green] }, `$${totalRevenue.toLocaleString()}`),
        ),
        React.createElement(View, null,
          React.createElement(Text, { style: s.statLabel }, 'CLIENTS'),
          React.createElement(Text, { style: s.statValue }, String(data.length)),
        ),
        React.createElement(View, null,
          React.createElement(Text, { style: s.statLabel }, 'INVOICES'),
          React.createElement(Text, { style: s.statValue }, String(totalInvoices)),
        ),
      ),

      React.createElement(View, { style: s.tableHeader },
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 3 }] }, 'Client'),
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 1, textAlign: 'right' }] }, 'Invoices'),
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 1, textAlign: 'right' }] }, 'Revenue'),
      ),
      ...data.map((row, i) =>
        React.createElement(View, { key: i, style: s.tableRow },
          React.createElement(Text, { style: [s.tableCell, { flex: 3 }] }, row.client_name),
          React.createElement(Text, { style: [s.tableCellRight, { flex: 1 }] }, String(row.invoice_count)),
          React.createElement(Text, { style: [s.tableCellRight, { flex: 1 }] }, `$${row.revenue.toLocaleString()}`),
        )
      ),
      React.createElement(View, { style: s.totalRow },
        React.createElement(Text, { style: [s.totalLabel, { flex: 3 }] }, 'Total'),
        React.createElement(Text, { style: [s.totalValue, { flex: 1 }] }, String(totalInvoices)),
        React.createElement(Text, { style: [s.totalValue, { flex: 1 }] }, `$${totalRevenue.toLocaleString()}`),
      ),

      React.createElement(Text, { style: s.footer }, `Generated ${new Date().toLocaleDateString()} — CommandPost`),
    )
  );
}
