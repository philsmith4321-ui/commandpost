import Link from 'next/link';
import { getDb } from '@/lib/db';
import { getAllScores, getNpsStats } from '@/lib/queries/satisfaction-queries';
import { addSatisfactionScoreAction } from '@/lib/actions/satisfaction-actions';

export const dynamic = 'force-dynamic';

export default function SatisfactionPage() {
  const db = getDb();
  const scores = getAllScores(db);
  const nps = getNpsStats(db);
  const clients = db.prepare("SELECT id, name FROM clients WHERE deleted_at IS NULL ORDER BY name").all() as { id: number; name: string }[];

  const npsColor = nps.nps >= 50 ? 'text-green-400' : nps.nps >= 0 ? 'text-yellow-400' : 'text-red-400';
  const scoreColor = (s: number) => s >= 9 ? 'text-green-400' : s >= 7 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Client Satisfaction</h2>
        <Link href="/reports" className="text-sm text-gray-400 hover:text-white">&larr; Reports</Link>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">NPS Score</p>
          <p className={`text-3xl font-bold ${npsColor}`}>{nps.total > 0 ? nps.nps : '—'}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Promoters (9-10)</p>
          <p className="text-2xl font-bold text-green-400">{nps.promoters}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Passives (7-8)</p>
          <p className="text-2xl font-bold text-yellow-400">{nps.passives}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Detractors (0-6)</p>
          <p className="text-2xl font-bold text-red-400">{nps.detractors}</p>
        </div>
      </div>

      {nps.total > 0 && (
        <div className="mb-8 p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <h3 className="text-sm font-medium text-gray-400 mb-2">NPS Distribution</h3>
          <div className="flex rounded overflow-hidden h-4">
            {nps.promoters > 0 && <div className="bg-green-500" style={{ width: `${(nps.promoters / nps.total) * 100}%` }} />}
            {nps.passives > 0 && <div className="bg-yellow-500" style={{ width: `${(nps.passives / nps.total) * 100}%` }} />}
            {nps.detractors > 0 && <div className="bg-red-500" style={{ width: `${(nps.detractors / nps.total) * 100}%` }} />}
          </div>
        </div>
      )}

      {/* Add Score */}
      <form action={addSatisfactionScoreAction} className="flex flex-wrap gap-3 mb-8 p-4 bg-gray-900 border border-gray-800 rounded-lg">
        <select name="client_id" required className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
          <option value="">Select Client</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="score" required className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
          {[10,9,8,7,6,5,4,3,2,1,0].map(s => (
            <option key={s} value={s}>{s} — {s >= 9 ? 'Promoter' : s >= 7 ? 'Passive' : 'Detractor'}</option>
          ))}
        </select>
        <input name="notes" placeholder="Notes (optional)" className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm" />
        <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg">Add Score</button>
      </form>

      {/* Score History */}
      {scores.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-left">
                <th className="p-2 font-medium">Client</th>
                <th className="p-2 font-medium text-center">Score</th>
                <th className="p-2 font-medium">Category</th>
                <th className="p-2 font-medium">Notes</th>
                <th className="p-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {scores.slice(0, 50).map(s => (
                <tr key={s.id} className="border-b border-gray-800/50">
                  <td className="p-2">
                    <Link href={`/clients/${s.client_id}`} className="text-white hover:text-blue-400">{s.client_name}</Link>
                  </td>
                  <td className={`p-2 text-center font-bold ${scoreColor(s.score)}`}>{s.score}</td>
                  <td className="p-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      s.score >= 9 ? 'bg-green-900/50 text-green-400' :
                      s.score >= 7 ? 'bg-yellow-900/50 text-yellow-400' :
                      'bg-red-900/50 text-red-400'
                    }`}>
                      {s.score >= 9 ? 'Promoter' : s.score >= 7 ? 'Passive' : 'Detractor'}
                    </span>
                  </td>
                  <td className="p-2 text-gray-400 truncate max-w-xs">{s.notes || '—'}</td>
                  <td className="p-2 text-gray-500">{s.scored_at.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
