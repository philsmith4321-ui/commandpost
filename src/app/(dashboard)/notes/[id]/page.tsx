import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { getNoteById } from '@/lib/queries/scratchpad-queries';
import { updateNoteAction, deleteNoteAction } from '@/lib/actions/scratchpad-actions';

export default async function NoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const note = getNoteById(db, Number(id));
  if (!note) notFound();

  return (
    <div className="p-4 sm:p-6 max-w-3xl">
      <Link href="/notes" className="text-sm text-gray-400 hover:text-white mb-4 inline-block">&larr; Back to Notes</Link>

      <form action={updateNoteAction} className="space-y-4">
        <input type="hidden" name="id" value={note.id} />
        <input
          name="title"
          defaultValue={note.title}
          className="w-full text-xl font-bold bg-transparent border-b border-gray-800 pb-2 focus:border-blue-500 outline-none"
        />
        <textarea
          name="content"
          defaultValue={note.content}
          rows={20}
          className="w-full bg-gray-900 border border-gray-800 rounded-lg p-4 text-sm font-mono resize-y min-h-[200px] focus:border-blue-500 outline-none"
        />
        <div className="flex gap-3">
          <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium">Save</button>
        </div>
      </form>

      <form action={deleteNoteAction} className="mt-8">
        <input type="hidden" name="id" value={note.id} />
        <button type="submit" className="text-xs text-red-500 hover:text-red-400">Delete note</button>
      </form>

      <p className="text-xs text-gray-600 mt-4">
        Last updated: {new Date(note.updated_at + 'Z').toLocaleString()}
      </p>
    </div>
  );
}
