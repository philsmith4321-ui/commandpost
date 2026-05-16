'use client';

import { useRouter } from 'next/navigation';
import { KanbanCard } from '@/components/kanban-card';
import { updateLeadStageAction } from '@/lib/actions/lead-actions';
import type { Lead, LeadStage } from '@/lib/types';

interface KanbanBoardProps {
  leadsByStage: Record<string, Lead[]>;
  stageEnteredDates: Record<number, string>;
}

const COLUMNS: { stage: LeadStage; label: string }[] = [
  { stage: 'new', label: 'New' },
  { stage: 'contacted', label: 'Contacted' },
  { stage: 'discovery', label: 'Discovery Call' },
  { stage: 'proposal', label: 'Proposal Sent' },
  { stage: 'negotiating', label: 'Negotiating' },
];

function daysBetween(dateStr: string): number {
  const then = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
}

export function KanbanBoard({ leadsByStage, stageEnteredDates }: KanbanBoardProps) {
  const router = useRouter();

  async function handleDrop(e: React.DragEvent, targetStage: LeadStage) {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-blue-900/20');
    const leadId = e.dataTransfer.getData('text/plain');
    if (!leadId) return;

    const formData = new FormData();
    formData.set('id', leadId);
    formData.set('stage', targetStage);
    await updateLeadStageAction(formData);
    router.refresh();
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('bg-blue-900/20');
  }

  function handleDragLeave(e: React.DragEvent) {
    e.currentTarget.classList.remove('bg-blue-900/20');
  }

  return (
    <div className="relative">
      <div className="sm:hidden absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-gray-950 to-transparent pointer-events-none z-10" />
      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '70vh' }}>
      {COLUMNS.map(({ stage, label }) => {
        const leads = leadsByStage[stage] || [];
        return (
          <div
            key={stage}
            className="flex-shrink-0 w-64 bg-gray-900/50 rounded-lg border border-gray-800 transition-colors"
            onDrop={(e) => handleDrop(e, stage)}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <div className="p-3 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-300">{label}</h3>
                <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                  {leads.length}
                </span>
              </div>
            </div>
            <div className="p-2 space-y-2 min-h-[200px]">
              {leads.map((lead) => (
                <KanbanCard
                  key={lead.id}
                  lead={lead}
                  daysInStage={daysBetween(stageEnteredDates[lead.id] || lead.updated_at)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
    </div>
  );
}
