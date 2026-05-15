import Link from 'next/link';
import type { Lead } from '@/lib/types';

interface KanbanCardProps {
  lead: Lead;
  daysInStage: number;
}

export function KanbanCard({ lead, daysInStage }: KanbanCardProps) {
  const agingColor =
    daysInStage >= 10
      ? 'border-red-800 bg-red-900/10'
      : daysInStage >= 5
      ? 'border-yellow-800 bg-yellow-900/10'
      : 'border-gray-800 bg-gray-900';

  return (
    <Link
      href={`/pipeline/${lead.id}`}
      draggable="true"
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', String(lead.id));
        e.dataTransfer.effectAllowed = 'move';
      }}
      className={`block p-3 rounded-lg border ${agingColor} hover:border-gray-700 transition-colors cursor-grab active:cursor-grabbing`}
    >
      <p className="text-sm font-medium text-white truncate">{lead.business_name}</p>
      {lead.contact_person && (
        <p className="text-xs text-gray-400 truncate">{lead.contact_person}</p>
      )}
      <div className="flex items-center justify-between mt-2">
        {lead.estimated_value ? (
          <span className="text-xs text-green-400">${lead.estimated_value.toLocaleString()}</span>
        ) : (
          <span />
        )}
        <span className={`text-xs ${daysInStage >= 10 ? 'text-red-400' : daysInStage >= 5 ? 'text-yellow-400' : 'text-gray-500'}`}>
          {daysInStage}d
        </span>
      </div>
    </Link>
  );
}
