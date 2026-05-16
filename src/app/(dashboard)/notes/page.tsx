import Link from 'next/link';
import { getDb } from '@/lib/db';
import { listNotes } from '@/lib/queries/scratchpad-queries';
import { createNoteAction, togglePinNoteAction } from '@/lib/actions/scratchpad-actions';

export const dynamic = 'force-dynamic';

export default function NotesPage() {
  const db = getDb();
  const notes = listNotes(db);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Scratchpad</h2>
      </div>

      <form action={createNoteAction} className="mb-6 flex gap-3">
        <input name="title" placeholder="New note title..." required className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm" />
        <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium">Create</button>
      </form>

      {notes.length === 0 ? (
        <p className="text-gray-500">No notes yet. Create one above.</p>
      ) : (
        <div className="space-y-2">
          {notes.map(note => (
            <div key={note.id} className="flex items-center gap-3 p-3 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors">
              <form action={togglePinNoteAction}>
                <input type="hidden" name="id" value={note.id} />
                <button type="submit" className="text-sm" title={note.is_pinned ? 'Unpin' : 'Pin'}>
                  {note.is_pinned ? '★' : '☆'}
                </button>
              </form>
              <Link href={`/notes/${note.id}`} className="flex-1 min-w-0">
                <span className="font-medium text-white">{note.title}</span>
                {note.content && <p className="text-xs text-gray-500 truncate mt-0.5">{note.content.slice(0, 100)}</p>}
              </Link>
              <span className="text-xs text-gray-600 whitespace-nowrap">
                {new Date(note.updated_at + 'Z').toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
