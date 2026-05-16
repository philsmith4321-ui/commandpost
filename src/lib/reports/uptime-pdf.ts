import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { reportStyles as s } from './pdf-styles';
import type { UptimeReportRow } from '@/lib/queries/report-queries';

export function buildUptimePdf(data: UptimeReportRow[]) {
  const allHealthy = data.every(e => e.uptime_percent >= 99.5);

  return React.createElement(Document, null,
    React.createElement(Page, { size: 'A4', style: s.page },
      React.createElement(Text, { style: s.title }, 'Ops Uptime Report'),
      React.createElement(Text, { style: s.subtitle }, `30-day summary — Generated ${new Date().toLocaleDateString()}`),

      React.createElement(View, { style: s.statBox },
        React.createElement(View, null,
          React.createElement(Text, { style: s.statLabel }, 'ENDPOINTS'),
          React.createElement(Text, { style: s.statValue }, String(data.length)),
        ),
        React.createElement(View, null,
          React.createElement(Text, { style: s.statLabel }, 'FLEET STATUS'),
          React.createElement(Text, { style: [s.statValue, allHealthy ? s.green : s.red] }, allHealthy ? 'All Healthy' : 'Issues Detected'),
        ),
      ),

      React.createElement(Text, { style: s.sectionTitle }, 'Endpoint Summary'),
      React.createElement(View, { style: s.tableHeader },
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 2 }] }, 'Endpoint'),
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 1, textAlign: 'right' }] }, 'Uptime'),
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 1, textAlign: 'right' }] }, 'Avg Response'),
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 1, textAlign: 'right' }] }, 'Incidents'),
      ),
      ...data.map((row, i) =>
        React.createElement(View, { key: i, style: s.tableRow },
          React.createElement(Text, { style: [s.tableCell, { flex: 2 }] }, row.name),
          React.createElement(Text, { style: [s.tableCellRight, { flex: 1 }] }, `${row.uptime_percent}%`),
          React.createElement(Text, { style: [s.tableCellRight, { flex: 1 }] }, `${row.avg_response_ms}ms`),
          React.createElement(Text, { style: [s.tableCellRight, { flex: 1 }] }, String(row.incident_count)),
        )
      ),

      ...data.filter(e => e.recent_incidents.length > 0).flatMap((ep, idx) => [
        React.createElement(Text, { key: `inc-title-${idx}`, style: [s.sectionTitle, { fontSize: 11 }] }, `Recent Incidents — ${ep.name}`),
        ...ep.recent_incidents.map((inc, j) =>
          React.createElement(View, { key: `inc-${idx}-${j}`, style: s.tableRow },
            React.createElement(Text, { style: [s.tableCell, { flex: 2 }] }, inc.started_at),
            React.createElement(Text, { style: [s.tableCell, { flex: 1 }] }, inc.resolved_at ? 'Resolved' : 'Ongoing'),
            React.createElement(Text, { style: [s.tableCellRight, { flex: 1 }] }, inc.duration_seconds ? `${Math.round(inc.duration_seconds / 60)}min` : '—'),
          )
        ),
      ]),

      React.createElement(Text, { style: s.footer }, `Generated ${new Date().toLocaleDateString()} — CommandPost`),
    )
  );
}
