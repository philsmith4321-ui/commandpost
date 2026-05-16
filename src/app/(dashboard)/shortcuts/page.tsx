export default function ShortcutsPage() {
  const shortcuts = [
    { keys: '⌘ K', description: 'Open command palette' },
    { keys: '⌘ /', description: 'Focus search' },
    { keys: 'Esc', description: 'Close modal / palette' },
    { keys: '↑ ↓', description: 'Navigate command palette items' },
    { keys: 'Enter', description: 'Execute selected command' },
  ];

  const quickNav = [
    { keys: '⌘K → "dash"', description: 'Go to Dashboard' },
    { keys: '⌘K → "inv"', description: 'Go to Invoices' },
    { keys: '⌘K → "pipe"', description: 'Go to Pipeline' },
    { keys: '⌘K → "time"', description: 'Go to Time Tracking' },
    { keys: '⌘K → "proj"', description: 'Go to Projects' },
    { keys: '⌘K → "new inv"', description: 'Create new invoice' },
    { keys: '⌘K → "new lead"', description: 'Create new lead' },
    { keys: '⌘K → "export"', description: 'Export data' },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-2xl">
      <h2 className="text-2xl font-bold mb-6">Keyboard Shortcuts</h2>

      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-3">Global Shortcuts</h3>
        <div className="space-y-2">
          {shortcuts.map((s, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-gray-900 border border-gray-800 rounded-lg">
              <span className="text-sm text-gray-300">{s.description}</span>
              <kbd className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs font-mono text-white">{s.keys}</kbd>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Command Palette Quick Navigation</h3>
        <p className="text-sm text-gray-500 mb-3">Press ⌘K then type to quickly navigate:</p>
        <div className="space-y-2">
          {quickNav.map((s, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-gray-900 border border-gray-800 rounded-lg">
              <span className="text-sm text-gray-300">{s.description}</span>
              <kbd className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs font-mono text-white">{s.keys}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
