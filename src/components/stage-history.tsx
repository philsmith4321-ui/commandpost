import type { LeadStageHistory } from '@/lib/types';

const stageLabels: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  discovery: 'Discovery Call',
  proposal: 'Proposal Sent',
  negotiating: 'Negotiating',
  won: 'Won',
  lost: 'Lost',
};

export function StageHistory({ history }: { history: LeadStageHistory[] }) {
  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold mb-4">Stage History</h3>
      <div className="space-y-2">
        {history.map((entry, i) => (
          <div key={entry.id} className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${i === history.length - 1 ? 'bg-blue-400' : 'bg-gray-600'}`} />
            <span className="text-sm text-white">{stageLabels[entry.stage] || entry.stage}</span>
            <span className="text-xs text-gray-500">
              {new Date(entry.entered_at + 'Z').toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
