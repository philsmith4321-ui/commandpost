'use client';

import { useState } from 'react';

interface ExportButtonProps {
  href: string;
  label: string;
  format: 'csv' | 'pdf';
  small?: boolean;
}

export function ExportButton({ href, label, format, small }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const icon = format === 'csv' ? '↓' : '⬇';
  const baseClasses = small
    ? 'px-2 py-1 text-xs'
    : 'px-3 py-1.5 text-sm';

  async function handleClick() {
    setLoading(true);
    try {
      const response = await fetch(href);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = response.headers.get('Content-Disposition');
      const filename = disposition?.match(/filename="(.+)"/)?.[1] || `report.${format}`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`${baseClasses} font-medium rounded-lg transition-colors bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 border border-gray-700 disabled:opacity-50`}
    >
      {loading ? '...' : `${icon} ${label}`}
    </button>
  );
}
