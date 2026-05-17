import Link from 'next/link';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function UtilizationPage({
  searchParams,
}: {
  searchParams: Promise<{ target?: string }>;
}) {
  const sp = await searchParams;
  const targetHoursPerWeek = Number(sp.target) || 40;
  const db = getDb();

  // Last 12 weeks of data
  const weeks: { label: string; startDate: string; endDate: string; hours: number; billable: number; utilization: number }[] = [];

  for (let w = 0; w < 12; w++) {
    const end = new Date();
    end.setDate(end.getDate() - end.getDay() - w * 7 + 6);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);

    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    const result = db.prepare(
      "SELECT COALESCE(SUM(duration_minutes), 0) as total_minutes, COALESCE(SUM(duration_minutes * hourly_rate / 60), 0) as billable FROM time_entries WHERE entry_date >= ? AND entry_date <= ?"
    ).get(startStr, endStr) as { total_minutes: number; billable: number };

    const hours = result.total_minutes / 60;
    const utilization = targetHoursPerWeek > 0 ? Math.round((hours / targetHoursPerWeek) * 100) : 0;

    weeks.push({
      label: w === 0 ? 'This week' : w === 1 ? 'Last week' : `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      startDate: startStr,
      endDate: endStr,
      hours,
      billable: result.billable,
      utilization,
    });
  }

  weeks.reverse();

  const avgUtilization = weeks.length > 0 ? Math.round(weeks.reduce((s, w) => s + w.utilization, 0) / weeks.length) : 0;
  const avgHours = weeks.length > 0 ? weeks.reduce((s, w) => s + w.hours, 0) / weeks.length : 0;
  const totalBillable = weeks.reduce((s, w) => s + w.billable, 0);
  const maxHours = Math.max(...weeks.map(w => w.hours), targetHoursPerWeek);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Utilization Dashboard</h2>
        <Link href="/reports" className="text-sm text-gray-400 hover:text-white">&larr; Reports</Link>
      </div>

      <form className="flex items-center gap-3 mb-6">
        <label className="text-sm text-gray-400">Target hours/week:</label>
        <input type="number" name="target" defaultValue={targetHoursPerWeek} min="1" max="80"
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm w-20" />
        <button type="submit" className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg">Update</button>
      </form>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Avg Utilization</p>
          <p className={`text-2xl font-bold ${avgUtilization >= 80 ? 'text-green-400' : avgUtilization >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
            {avgUtilization}%
          </p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Avg Hours/Week</p>
          <p className="text-2xl font-bold text-white">{avgHours.toFixed(1)}h</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Target</p>
          <p className="text-2xl font-bold text-white">{targetHoursPerWeek}h</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">12-Week Billable</p>
          <p className="text-2xl font-bold text-green-400">${totalBillable.toLocaleString()}</p>
        </div>
      </div>

      {/* Weekly chart */}
      <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg mb-8">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Weekly Hours (last 12 weeks)</h3>
        <div className="flex items-end gap-2 h-40 relative">
          {/* Target line */}
          <div className="absolute left-0 right-0 border-t border-dashed border-yellow-500/50"
            style={{ bottom: `${(targetHoursPerWeek / maxHours) * 140}px` }}>
            <span className="absolute -top-4 right-0 text-xs text-yellow-500">Target: {targetHoursPerWeek}h</span>
          </div>
          {weeks.map((w, i) => {
            const height = maxHours > 0 ? (w.hours / maxHours) * 140 : 0;
            const color = w.utilization >= 80 ? 'bg-green-500' : w.utilization >= 50 ? 'bg-yellow-500' : 'bg-red-500';
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-gray-500">{w.hours.toFixed(0)}h</span>
                <div className={`w-full ${color} rounded-t`} style={{ height: `${height}px` }} />
                <span className="text-xs text-gray-600 truncate w-full text-center">{w.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Weekly detail table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500 text-left">
              <th className="p-2 font-medium">Week</th>
              <th className="p-2 font-medium text-right">Hours</th>
              <th className="p-2 font-medium text-right">Billable</th>
              <th className="p-2 font-medium text-right">Utilization</th>
              <th className="p-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {[...weeks].reverse().map((w, i) => (
              <tr key={i} className="border-b border-gray-800/50">
                <td className="p-2 text-white">{w.label}</td>
                <td className="p-2 text-right text-gray-300">{w.hours.toFixed(1)}h</td>
                <td className="p-2 text-right text-green-400">${w.billable.toLocaleString()}</td>
                <td className="p-2 text-right text-white">{w.utilization}%</td>
                <td className="p-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    w.utilization >= 80 ? 'bg-green-900/50 text-green-400' :
                    w.utilization >= 50 ? 'bg-yellow-900/50 text-yellow-400' :
                    'bg-red-900/50 text-red-400'
                  }`}>
                    {w.utilization >= 80 ? 'On Track' : w.utilization >= 50 ? 'Under' : 'Low'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
