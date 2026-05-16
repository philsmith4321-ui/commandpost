'use client';

import { useState } from 'react';

interface ReportDatePickerProps {
  onChange: (start: string, end: string) => void;
}

function getPresetDates(preset: string): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.toISOString().split('T')[0];

  switch (preset) {
    case 'this_month': {
      const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      return { start, end: today };
    }
    case 'last_month': {
      const lm = new Date(year, month - 1, 1);
      const lmEnd = new Date(year, month, 0);
      return {
        start: lm.toISOString().split('T')[0],
        end: lmEnd.toISOString().split('T')[0],
      };
    }
    case 'last_quarter': {
      const qStart = new Date(year, month - 3, 1);
      return { start: qStart.toISOString().split('T')[0], end: today };
    }
    case 'ytd':
      return { start: `${year}-01-01`, end: today };
    default:
      return { start: `${year}-01-01`, end: today };
  }
}

export function ReportDatePicker({ onChange }: ReportDatePickerProps) {
  const defaults = getPresetDates('ytd');
  const [start, setStart] = useState(defaults.start);
  const [end, setEnd] = useState(defaults.end);
  const [active, setActive] = useState('ytd');

  function selectPreset(preset: string) {
    const dates = getPresetDates(preset);
    setStart(dates.start);
    setEnd(dates.end);
    setActive(preset);
    onChange(dates.start, dates.end);
  }

  function handleCustomChange(newStart: string, newEnd: string) {
    setStart(newStart);
    setEnd(newEnd);
    setActive('custom');
    onChange(newStart, newEnd);
  }

  const presets = [
    { key: 'this_month', label: 'This Month' },
    { key: 'last_month', label: 'Last Month' },
    { key: 'last_quarter', label: 'Last Quarter' },
    { key: 'ytd', label: 'YTD' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map(p => (
        <button
          key={p.key}
          onClick={() => selectPreset(p.key)}
          className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
            active === p.key ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          {p.label}
        </button>
      ))}
      <input
        type="date"
        value={start}
        onChange={(e) => handleCustomChange(e.target.value, end)}
        className="px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded-lg text-white"
      />
      <span className="text-gray-500 text-xs">to</span>
      <input
        type="date"
        value={end}
        onChange={(e) => handleCustomChange(start, e.target.value)}
        className="px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded-lg text-white"
      />
    </div>
  );
}
