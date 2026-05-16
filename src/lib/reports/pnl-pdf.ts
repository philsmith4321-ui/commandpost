import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { reportStyles as s } from './pdf-styles';
import type { PnlData } from '@/lib/queries/report-queries';

export function buildPnlPdf(data: PnlData, start: string, end: string) {
  const margin = data.revenue > 0 ? Math.round((data.profit / data.revenue) * 100) : 0;

  return React.createElement(Document, null,
    React.createElement(Page, { size: 'A4', style: s.page },
      React.createElement(Text, { style: s.title }, 'Profit & Loss Statement'),
      React.createElement(Text, { style: s.subtitle }, `${start} to ${end}`),

      React.createElement(View, { style: s.statBox },
        React.createElement(View, null,
          React.createElement(Text, { style: s.statLabel }, 'REVENUE'),
          React.createElement(Text, { style: [s.statValue, s.green] }, `$${data.revenue.toLocaleString()}`),
        ),
        React.createElement(View, null,
          React.createElement(Text, { style: s.statLabel }, 'EXPENSES'),
          React.createElement(Text, { style: [s.statValue, s.red] }, `$${data.totalExpenses.toLocaleString()}`),
        ),
        React.createElement(View, null,
          React.createElement(Text, { style: s.statLabel }, 'NET PROFIT'),
          React.createElement(Text, { style: [s.statValue, data.profit >= 0 ? s.green : s.red] }, `$${data.profit.toLocaleString()}`),
        ),
        React.createElement(View, null,
          React.createElement(Text, { style: s.statLabel }, 'MARGIN'),
          React.createElement(Text, { style: s.statValue }, `${margin}%`),
        ),
      ),

      React.createElement(Text, { style: s.sectionTitle }, 'Expenses by Category'),
      React.createElement(View, { style: s.tableHeader },
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 3 }] }, 'Category'),
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 1, textAlign: 'right' }] }, 'Amount'),
      ),
      ...data.expensesByCategory.map((row, i) =>
        React.createElement(View, { key: i, style: s.tableRow },
          React.createElement(Text, { style: [s.tableCell, { flex: 3 }] }, row.category),
          React.createElement(Text, { style: [s.tableCellRight, { flex: 1 }] }, `$${row.amount.toLocaleString()}`),
        )
      ),

      React.createElement(Text, { style: s.footer }, `Generated ${new Date().toLocaleDateString()} — CommandPost`),
    )
  );
}
