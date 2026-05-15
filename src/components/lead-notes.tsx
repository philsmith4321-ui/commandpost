'use client';

import { useRef } from 'react';
import { addLeadNoteAction } from '@/lib/actions/lead-actions';
import type { LeadNote } from '@/lib/types';

interface LeadNotesProps {
  leadId: number;
  notes: LeadNote[];
}

export function LeadNotes({ leadId, notes }: LeadNotesProps) {
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    await addLeadNoteAction(formData);
    formRef.current?.reset();
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Notes</h3>

      <form ref={formRef} action={handleSubmit} className="mb-4 flex gap-2">
        <input type="hidden" name="lead_id" value={leadId} />
        <input type="text" name="content" required placeholder="Add a note — call, email, meeting..."
          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
        <button type="submit"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
          Add
        </button>
      </form>

      {notes.length === 0 ? (
        <p className="text-sm text-gray-500">No notes yet.</p>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <div key={note.id} className="flex gap-3 p-3 bg-gray-900 border border-gray-800 rounded-lg">
              <div className="w-1.5 h-1.5 rounded-full bg-gray-600 mt-2 shrink-0" />
              <div>
                <p className="text-sm text-white">{note.content}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(note.created_at + 'Z').toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
