'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Command {
  id: string;
  label: string;
  section: string;
  action: () => void;
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const commands: Command[] = [
    // Navigation
    { id: 'nav-dashboard', label: 'Go to Dashboard', section: 'Navigation', action: () => router.push('/') },
    { id: 'nav-clients', label: 'Go to Clients', section: 'Navigation', action: () => router.push('/clients') },
    { id: 'nav-pipeline', label: 'Go to Pipeline', section: 'Navigation', action: () => router.push('/pipeline') },
    { id: 'nav-proposals', label: 'Go to Proposals', section: 'Navigation', action: () => router.push('/proposals') },
    { id: 'nav-finances', label: 'Go to Finances', section: 'Navigation', action: () => router.push('/finances') },
    { id: 'nav-invoices', label: 'Go to Invoices', section: 'Navigation', action: () => router.push('/finances/invoices/new') },
    { id: 'nav-time', label: 'Go to Time Tracking', section: 'Navigation', action: () => router.push('/finances/time') },
    { id: 'nav-ops', label: 'Go to Ops', section: 'Navigation', action: () => router.push('/ops') },
    { id: 'nav-reports', label: 'Go to Reports', section: 'Navigation', action: () => router.push('/reports') },
    { id: 'nav-board', label: 'Go to Board', section: 'Navigation', action: () => router.push('/board') },
    { id: 'nav-recurring', label: 'Go to Recurring Tasks', section: 'Navigation', action: () => router.push('/recurring') },
    { id: 'nav-meetings', label: 'Go to Meetings', section: 'Navigation', action: () => router.push('/meetings') },
    { id: 'nav-goals', label: 'Go to Goals', section: 'Navigation', action: () => router.push('/goals') },
    { id: 'nav-digest', label: 'Weekly Digest', section: 'Navigation', action: () => router.push('/digest') },
    { id: 'nav-templates', label: 'Go to Templates', section: 'Navigation', action: () => router.push('/templates') },
    { id: 'nav-notifications', label: 'Go to Notifications', section: 'Navigation', action: () => router.push('/notifications') },
    { id: 'nav-settings', label: 'Notification Settings', section: 'Navigation', action: () => router.push('/settings/notifications') },
    // Actions
    { id: 'act-new-invoice', label: 'New Invoice', section: 'Actions', action: () => router.push('/finances/invoices/new') },
    { id: 'act-new-lead', label: 'New Lead', section: 'Actions', action: () => router.push('/pipeline/new') },
    { id: 'act-new-proposal', label: 'New Proposal', section: 'Actions', action: () => router.push('/proposals/new') },
    { id: 'act-new-template', label: 'New Template', section: 'Actions', action: () => router.push('/templates/new') },
    { id: 'act-use-template', label: 'Create Project from Template', section: 'Actions', action: () => router.push('/templates/use') },
    { id: 'act-new-endpoint', label: 'New Endpoint', section: 'Actions', action: () => router.push('/ops/new') },
    { id: 'act-log-time', label: 'Log Time', section: 'Actions', action: () => router.push('/finances/time') },
    { id: 'act-log-meeting', label: 'Log Meeting', section: 'Actions', action: () => router.push('/meetings/new') },
    { id: 'act-export', label: 'Export Data', section: 'Actions', action: () => router.push('/export') },
    { id: 'nav-overdue', label: 'Overdue Invoices', section: 'Navigation', action: () => router.push('/finances/overdue') },
    { id: 'nav-timeline', label: 'Activity Timeline', section: 'Navigation', action: () => router.push('/timeline') },
    { id: 'nav-projects', label: 'Go to Projects', section: 'Navigation', action: () => router.push('/projects') },
    { id: 'nav-contacts', label: 'Go to Contacts', section: 'Navigation', action: () => router.push('/contacts') },
    { id: 'nav-emails', label: 'Email Log', section: 'Navigation', action: () => router.push('/emails') },
    { id: 'nav-shortcuts', label: 'Keyboard Shortcuts', section: 'Navigation', action: () => router.push('/shortcuts') },
    { id: 'nav-onboarding', label: 'Onboarding Templates', section: 'Navigation', action: () => router.push('/onboarding') },
    { id: 'nav-lead-scores', label: 'Lead Scores', section: 'Navigation', action: () => router.push('/pipeline/scores') },
    { id: 'nav-snapshots', label: 'Metric Snapshots', section: 'Navigation', action: () => router.push('/reports/snapshots') },
    { id: 'nav-notes', label: 'Scratchpad / Notes', section: 'Navigation', action: () => router.push('/notes') },
    { id: 'nav-funnel', label: 'Pipeline Funnel', section: 'Navigation', action: () => router.push('/pipeline/funnel') },
    { id: 'nav-settings-main', label: 'Settings', section: 'Navigation', action: () => router.push('/settings') },
    { id: 'nav-yearly', label: 'Yearly Report', section: 'Navigation', action: () => router.push('/reports/yearly') },
    { id: 'nav-client-revenue', label: 'Client Revenue Report', section: 'Navigation', action: () => router.push('/reports/clients') },
  ];

  const filtered = query
    ? commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setIsOpen(prev => !prev);
      setQuery('');
      setSelectedIndex(0);
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault();
      filtered[selectedIndex].action();
      setIsOpen(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]">
      <div className="fixed inset-0 bg-black/60" onClick={() => setIsOpen(false)} />
      <div className="relative w-full max-w-lg bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
          <span className="text-gray-500 text-sm">⌘</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-500"
          />
          <kbd className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">ESC</kbd>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-500 text-center">No results found.</p>
          ) : (
            <>
              {['Navigation', 'Actions'].map(section => {
                const sectionItems = filtered.filter(c => c.section === section);
                if (sectionItems.length === 0) return null;
                return (
                  <div key={section}>
                    <p className="px-4 pt-3 pb-1 text-xs text-gray-500 uppercase">{section}</p>
                    {sectionItems.map((cmd) => {
                      const idx = filtered.indexOf(cmd);
                      return (
                        <button
                          key={cmd.id}
                          onClick={() => { cmd.action(); setIsOpen(false); }}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                            idx === selectedIndex ? 'bg-blue-600/20 text-blue-400' : 'text-white hover:bg-gray-800'
                          }`}
                        >
                          {cmd.label}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}
        </div>
        <div className="border-t border-gray-800 px-4 py-2 flex gap-4 text-xs text-gray-500">
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>ESC Close</span>
        </div>
      </div>
    </div>
  );
}
