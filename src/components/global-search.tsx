'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface SearchResult {
  type: string;
  id: number;
  title: string;
  subtitle: string | null;
  link: string;
}

const typeColors: Record<string, string> = {
  Client: 'text-blue-400',
  Project: 'text-green-400',
  Lead: 'text-purple-400',
  Invoice: 'text-yellow-400',
  Proposal: 'text-cyan-400',
  Note: 'text-orange-400',
  Contract: 'text-emerald-400',
};

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (query.length < 2) return;

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data);
      setIsOpen(true);
      setLoading(false);
    }, 200);
  }, [query]);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (value.length < 2) {
      setResults([]);
      setIsOpen(false);
      setLoading(false);
    } else {
      setLoading(true);
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(link: string) {
    setIsOpen(false);
    setQuery('');
    setResults([]);
    router.push(link);
  }

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        placeholder="Search..."
        className="w-48 sm:w-64 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
      />
      {isOpen && results.length > 0 && (
        <div className="absolute top-full mt-1 right-0 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
          {results.map((r, i) => (
            <button
              key={`${r.type}-${r.id}-${i}`}
              onClick={() => handleSelect(r.link)}
              className="w-full text-left px-4 py-3 hover:bg-gray-800 transition-colors border-b border-gray-800 last:border-b-0"
            >
              <span className={`text-xs uppercase font-medium ${typeColors[r.type] || 'text-gray-400'}`}>
                {r.type}
              </span>
              <p className="text-sm text-white truncate">{r.title}</p>
              {r.subtitle && <p className="text-xs text-gray-500 truncate">{r.subtitle}</p>}
            </button>
          ))}
        </div>
      )}
      {isOpen && results.length === 0 && !loading && query.length >= 2 && (
        <div className="absolute top-full mt-1 right-0 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 p-4">
          <p className="text-sm text-gray-500">No results found.</p>
        </div>
      )}
    </div>
  );
}
