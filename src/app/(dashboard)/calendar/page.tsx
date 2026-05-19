import { getDb } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface CalendarEvent {
  date: string;
  title: string;
  type: string;
  link: string;
  color: string;
}

function getMonthEvents(db: ReturnType<typeof getDb>, year: number, month: number): CalendarEvent[] {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  const events: CalendarEvent[] = [];

  const meetings = db.prepare(
    "SELECT id, title, meeting_date FROM meetings WHERE meeting_date >= ? AND meeting_date < ? ORDER BY meeting_date"
  ).all(start, end) as any[];
  for (const m of meetings) {
    events.push({ date: m.meeting_date, title: m.title, type: 'meeting', link: '/meetings', color: 'bg-blue-600' });
  }

  const invoices = db.prepare(
    "SELECT i.id, i.invoice_number, i.due_date FROM invoices i WHERE i.status = 'sent' AND i.due_date >= ? AND i.due_date < ?"
  ).all(start, end) as any[];
  for (const i of invoices) {
    events.push({ date: i.due_date, title: `Invoice ${i.invoice_number} due`, type: 'invoice_due', link: `/finances/invoices/${i.id}`, color: 'bg-yellow-600' });
  }

  const followups = db.prepare(
    "SELECT id, business_name, follow_up_date FROM leads WHERE follow_up_date >= ? AND follow_up_date < ? AND stage NOT IN ('won','lost')"
  ).all(start, end) as any[];
  for (const f of followups) {
    events.push({ date: f.follow_up_date, title: `Follow up: ${f.business_name}`, type: 'follow_up', link: `/pipeline/${f.id}`, color: 'bg-purple-600' });
  }

  const goals = db.prepare(
    "SELECT id, title, period_end FROM goals WHERE period_end >= ? AND period_end < ? AND is_active = 1"
  ).all(start, end) as any[];
  for (const g of goals) {
    events.push({ date: g.period_end, title: g.title, type: 'goal', link: '/calendar', color: 'bg-green-600' });
  }

  const proposals = db.prepare(
    "SELECT id, title, valid_until FROM proposals WHERE valid_until >= ? AND valid_until < ? AND status = 'sent'"
  ).all(start, end) as any[];
  for (const p of proposals) {
    events.push({ date: p.valid_until, title: `Expires: ${p.title}`, type: 'deadline', link: `/proposals/${p.id}`, color: 'bg-red-600' });
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const year = Number(sp.year) || now.getFullYear();
  const month = Number(sp.month) || now.getMonth() + 1;

  const db = getDb();
  const events = getMonthEvents(db, year, month);

  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startPad = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const monthName = firstDay.toLocaleString('default', { month: 'long' });

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  const today = now.toISOString().split('T')[0];

  const days: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let i = 1; i <= totalDays; i++) days.push(i);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Calendar</h2>
        <div className="flex items-center gap-4">
          <Link href={`/calendar?year=${prevYear}&month=${prevMonth}`} className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm">&larr;</Link>
          <span className="text-lg font-medium">{monthName} {year}</span>
          <Link href={`/calendar?year=${nextYear}&month=${nextMonth}`} className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm">&rarr;</Link>
        </div>
      </div>

      <div className="flex gap-4 mb-4 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-blue-600" /> Meeting</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-yellow-600" /> Invoice Due</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-purple-600" /> Follow-up</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-green-600" /> Goal</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-600" /> Deadline</span>
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-800 rounded-lg overflow-hidden">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="p-2 text-center text-xs text-gray-500 font-medium bg-gray-900">{d}</div>
        ))}
        {days.map((day, i) => {
          const dateStr = day ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
          const dayEvents = day ? events.filter(e => e.date === dateStr) : [];
          const isToday = dateStr === today;
          return (
            <div key={i} className={`min-h-24 p-1.5 bg-gray-900 ${!day ? 'opacity-30' : ''}`}>
              {day && (
                <>
                  <span className={`text-xs font-medium ${isToday ? 'bg-blue-600 text-white px-1.5 py-0.5 rounded-full' : 'text-gray-400'}`}>
                    {day}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {dayEvents.slice(0, 3).map((evt, j) => (
                      <Link key={j} href={evt.link} className={`block text-xs px-1 py-0.5 rounded truncate text-white ${evt.color} hover:opacity-80`}>
                        {evt.title}
                      </Link>
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="text-xs text-gray-500">+{dayEvents.length - 3} more</span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
