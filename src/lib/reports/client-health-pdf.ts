import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { reportStyles as s } from './pdf-styles';
import type { ClientHealth } from '@/lib/types';

export function buildClientHealthPdf(clients: ClientHealth[]) {
  const needsAttention = clients.filter(c => c.status === 'needs_attention');
  const atRisk = clients.filter(c => c.status === 'at_risk');
  const healthy = clients.filter(c => c.status === 'healthy');

  const statusColors: Record<string, string> = {
    healthy: '#16a34a',
    at_risk: '#d97706',
    needs_attention: '#dc2626',
  };

  const renderGroup = (title: string, group: ClientHealth[], color: string) => {
    if (group.length === 0) return [];
    return [
      React.createElement(Text, { key: `title-${title}`, style: [s.sectionTitle, { color }] }, `${title} (${group.length})`),
      React.createElement(View, { key: `header-${title}`, style: s.tableHeader },
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 3 }] }, 'Client'),
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 1, textAlign: 'right' }] }, 'Score'),
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 1, textAlign: 'right' }] }, 'Payment'),
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 1, textAlign: 'right' }] }, 'Balance'),
        React.createElement(Text, { style: [s.tableHeaderText, { flex: 1, textAlign: 'right' }] }, 'Engage'),
      ),
      ...group.map((c, i) =>
        React.createElement(View, { key: `row-${title}-${i}`, style: s.tableRow },
          React.createElement(Text, { style: [s.tableCell, { flex: 3 }] }, c.clientName),
          React.createElement(Text, { style: [s.tableCellRight, { flex: 1 }] }, String(c.score)),
          React.createElement(Text, { style: [s.tableCellRight, { flex: 1 }] }, `${c.payment}/40`),
          React.createElement(Text, { style: [s.tableCellRight, { flex: 1 }] }, `${c.balance}/30`),
          React.createElement(Text, { style: [s.tableCellRight, { flex: 1 }] }, `${c.engagement}/30`),
        )
      ),
    ];
  };

  return React.createElement(Document, null,
    React.createElement(Page, { size: 'A4', style: s.page },
      React.createElement(Text, { style: s.title }, 'Client Health Report'),
      React.createElement(Text, { style: s.subtitle }, `Generated ${new Date().toLocaleDateString()} — ${clients.length} active clients`),

      React.createElement(View, { style: s.statBox },
        React.createElement(View, null,
          React.createElement(Text, { style: s.statLabel }, 'HEALTHY'),
          React.createElement(Text, { style: [s.statValue, { color: '#16a34a' }] }, String(healthy.length)),
        ),
        React.createElement(View, null,
          React.createElement(Text, { style: s.statLabel }, 'AT RISK'),
          React.createElement(Text, { style: [s.statValue, { color: '#d97706' }] }, String(atRisk.length)),
        ),
        React.createElement(View, null,
          React.createElement(Text, { style: s.statLabel }, 'NEEDS ATTENTION'),
          React.createElement(Text, { style: [s.statValue, { color: '#dc2626' }] }, String(needsAttention.length)),
        ),
      ),

      ...renderGroup('Needs Attention', needsAttention, statusColors.needs_attention),
      ...renderGroup('At Risk', atRisk, statusColors.at_risk),
      ...renderGroup('Healthy', healthy, statusColors.healthy),

      React.createElement(Text, { style: s.footer }, `Generated ${new Date().toLocaleDateString()} — CommandPost`),
    )
  );
}
