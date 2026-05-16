import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { reportStyles as s } from './pdf-styles';
import type { PipelineReportData } from '@/lib/queries/report-queries';

export function buildPipelinePdf(data: PipelineReportData) {
  return React.createElement(Document, null,
    React.createElement(Page, { size: 'A4', style: s.page },
      React.createElement(Text, { style: s.title }, 'Pipeline Report'),
      React.createElement(Text, { style: s.subtitle }, `Generated ${new Date().toLocaleDateString()}`),

      React.createElement(View, { style: s.statBox },
        React.createElement(View, null,
          React.createElement(Text, { style: s.statLabel }, 'ACTIVE LEADS'),
          React.createElement(Text, { style: s.statValue }, String(data.totalActiveLeads)),
        ),
        React.createElement(View, null,
          React.createElement(Text, { style: s.statLabel }, 'PIPELINE VALUE'),
          React.createElement(Text, { style: [s.statValue, s.green] }, `$${data.totalActiveValue.toLocaleString()}`),
        ),
        React.createElement(View, null,
          React.createElement(Text, { style: s.statLabel }, 'CONVERSION RATE'),
          React.createElement(Text, { style: s.statValue }, `${Math.round(data.conversionRate)}%`),
        ),
        React.createElement(View, null,
          React.createElement(Text, { style: s.statLabel }, 'AVG DEAL'),
          React.createElement(Text, { style: s.statValue }, `$${Math.round(data.averageDealValue).toLocaleString()}`),
        ),
      ),

      data.needsFollowUp > 0 ? React.createElement(View, { style: { marginBottom: 12, padding: 8, backgroundColor: '#fef3c7', borderRadius: 4 } },
        React.createElement(Text, { style: { fontSize: 10, color: '#92400e' } }, `${data.needsFollowUp} lead${data.needsFollowUp > 1 ? 's' : ''} need follow-up`),
      ) : null,

      React.createElement(Text, { style: s.sectionTitle }, 'By Stage'),
      React.createElement(View, { style: s.tableHeader },
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 2 }] }, 'Stage'),
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 1, textAlign: 'right' }] }, 'Leads'),
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 1, textAlign: 'right' }] }, 'Value'),
      ),
      ...data.stageBreakdown.map((row, i) =>
        React.createElement(View, { key: i, style: s.tableRow },
          React.createElement(Text, { style: [s.tableCell, { flex: 2 }] }, row.stage),
          React.createElement(Text, { style: [s.tableCellRight, { flex: 1 }] }, String(row.count)),
          React.createElement(Text, { style: [s.tableCellRight, { flex: 1 }] }, `$${row.value.toLocaleString()}`),
        )
      ),

      React.createElement(Text, { style: s.sectionTitle }, 'Top Leads by Value'),
      React.createElement(View, { style: s.tableHeader },
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 3 }] }, 'Business'),
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 1 }] }, 'Stage'),
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 1, textAlign: 'right' }] }, 'Value'),
      ),
      ...data.topLeads.map((lead, i) =>
        React.createElement(View, { key: i, style: s.tableRow },
          React.createElement(Text, { style: [s.tableCell, { flex: 3 }] }, lead.business_name),
          React.createElement(Text, { style: [s.tableCell, { flex: 1 }] }, lead.stage),
          React.createElement(Text, { style: [s.tableCellRight, { flex: 1 }] }, `$${lead.estimated_value.toLocaleString()}`),
        )
      ),

      React.createElement(Text, { style: s.footer }, `Generated ${new Date().toLocaleDateString()} — CommandPost`),
    )
  );
}
